"""
smart-sync.py

Correcções face à versão anterior:
  1. /reject-lines: comparação linha-a-linha em vez de pattern substring
     — um hunk é rejeitado se QUALQUER linha "+" do hunk coincidir com
       QUALQUER linha "+" de um rejected_hunk registado.
  2. Aplicação parcial real: quando um ficheiro tem hunks aceites E
     rejeitados, aplica apenas os hunks aceites via `git apply --3way`.
  3. Ficheiros deletados no template são também deletados no filho
     (a não ser que estejam em .templatesyncignore ou rejeitados).
"""

import subprocess, json, os, fnmatch, tempfile, re

# ---------------------------------------------------------------------------
# Utilitários git
# ---------------------------------------------------------------------------

def run(cmd: str) -> str:
    return subprocess.check_output(cmd, shell=True, text=True)

def run_safe(cmd: str):
    try:
        return subprocess.check_output(cmd, shell=True, text=True), None
    except subprocess.CalledProcessError as e:
        return None, str(e)

# ---------------------------------------------------------------------------
# .templatesyncignore
# ---------------------------------------------------------------------------

def load_templatesyncignore(path=".github/.templatesyncignore"):
    patterns = []
    if not os.path.exists(path):
        return patterns
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                patterns.append(line)
    return patterns

def is_ignored(filepath: str, patterns: list) -> bool:
    for pattern in patterns:
        if pattern.endswith("/"):
            if filepath.startswith(pattern) or filepath.startswith(pattern.rstrip("/")):
                return True
        if fnmatch.fnmatch(filepath, pattern):
            return True
        if filepath.startswith(pattern + "/"):
            return True
        if filepath == pattern:
            return True
    return False

# ---------------------------------------------------------------------------
# Helpers git
# ---------------------------------------------------------------------------

def file_exists_in_template(filepath: str) -> bool:
    """Verifica se o ficheiro existe no template (template/main)."""
    out, err = run_safe(f"git ls-tree -r --name-only template/main -- '{filepath}'")
    if err or not out:
        return False
    return filepath in out.splitlines()

def file_exists_locally(filepath: str) -> bool:
    return os.path.exists(filepath)

def get_diff_files_with_status():
    """
    Devolve lista de (status, filepath).
    status: 'M' modificado, 'A' adicionado no template, 'D' eliminado no template.
    Usa --diff-filter para separar claramente os casos.
    """
    # Compara HEAD (filho) com template/main (template)
    # 'D' do ponto de vista desta comparação = existe no filho mas não no template
    # 'A' = existe no template mas não no filho
    out, err = run_safe("git diff --name-status HEAD template/main")
    if err or not out:
        return []
    results = []
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split("\t", 1)
        if len(parts) == 2:
            status, path = parts[0][0], parts[1]  # primeiro char do status
            results.append((status, path))
    return results

def get_file_diff(filepath: str) -> str:
    out, _ = run_safe(f"git diff HEAD template/main -- '{filepath}'")
    return out or ""

# ---------------------------------------------------------------------------
# Reject-lines: comparação linha-a-linha
# ---------------------------------------------------------------------------

def _added_lines(text: str) -> set:
    """
    Extrai o conjunto de linhas "+" (sem o prefixo "+") de um diff/hunk.
    Remove espaços extra para uma comparação robusta.
    """
    lines = set()
    for l in text.splitlines():
        if l.startswith("+") and not l.startswith("+++"):
            lines.add(l[1:].strip())
    return lines

def hunk_is_rejected(hunk_text: str, rejections_for_file: dict) -> bool:
    """
    Um hunk é rejeitado se QUALQUER linha "+" do hunk coincidir com
    QUALQUER linha "+" dos rejected_hunks registados.

    Isto corrige o bug anterior onde o 'pattern' (3 linhas concatenadas
    com espaço) raramente batia com o texto completo do hunk.
    """
    if not rejections_for_file:
        return False

    rejected_hunks = rejections_for_file.get("rejected_hunks", [])
    if not rejected_hunks:
        return False

    hunk_added = _added_lines(hunk_text)
    if not hunk_added:
        return False  # hunk só de remoção, nunca rejeitado por reject-lines

    # Linhas de todos os rejected_hunks registados
    all_rejected_lines: set = set()
    for rh in rejected_hunks:
        # Suporte ao formato antigo (pattern = string) e novo (lines = lista)
        if "lines" in rh:
            for ln in rh["lines"]:
                all_rejected_lines.add(ln.strip())
        elif "pattern" in rh:
            # Formato legado: linha(s) separadas por espaço ou newline
            for ln in re.split(r"(?:\\n|\n)", rh["pattern"]):
                all_rejected_lines.add(ln.strip())

    return bool(hunk_added & all_rejected_lines)

# ---------------------------------------------------------------------------
# Parse de hunks
# ---------------------------------------------------------------------------

def parse_hunks(diff_text: str) -> list:
    """
    Divide um diff completo em lista de hunks (cada um começa em @@).
    O primeiro bloco (cabeçalho --- / +++) é guardado separadamente.
    Devolve (header, [hunk, ...]).
    """
    lines = diff_text.splitlines(keepends=True)
    header_lines = []
    hunks = []
    current: list = []
    in_hunks = False

    for line in lines:
        if line.startswith("@@"):
            if current:
                hunks.append("".join(current))
            current = [line]
            in_hunks = True
        elif not in_hunks:
            header_lines.append(line)
        else:
            current.append(line)

    if current:
        hunks.append("".join(current))

    return "".join(header_lines), hunks

# ---------------------------------------------------------------------------
# Aplicação parcial de hunks via git apply
# ---------------------------------------------------------------------------

def apply_partial_hunks(filepath: str, diff_header: str, accepted_hunks: list) -> bool:
    """
    Aplica apenas os `accepted_hunks` a `filepath` usando `git apply --3way`.
    Devolve True em caso de sucesso.
    """
    patch = diff_header + "".join(accepted_hunks)
    with tempfile.NamedTemporaryFile(mode="w", suffix=".patch", delete=False) as f:
        f.write(patch)
        patch_path = f.name
    try:
        _, err = run_safe(f"git apply --3way --whitespace=fix '{patch_path}'")
        return err is None
    finally:
        os.unlink(patch_path)

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    rejected_file = ".github/sync-rejected.json"

    # Padrões a ignorar sempre
    ignore_patterns = load_templatesyncignore()
    ignore_patterns += [
        ".github/sync-rejected.json",
        ".github/.templatesyncignore",
    ]

    # Rejeicões manuais guardadas
    if os.path.exists(rejected_file):
        with open(rejected_file) as f:
            rejected = json.load(f)
    else:
        rejected = {}

    diff_entries = get_diff_files_with_status()

    if not diff_entries:
        print("Sem alterações para sincronizar.")
        _write_outputs(False, "Sem alterações", "Sem alterações para sincronizar.")
        return

    accepted_files  = []
    deleted_files   = []
    partial_files   = []
    skipped_files   = []
    only_in_child   = []  # 'D' no diff = só existe no filho
    pr_body_lines   = [
        "## Alterações do template\n",
        "Para rejeitar um ficheiro inteiro comenta: `/reject caminho/ficheiro Motivo`",
        "Para rejeitar linhas específicas comenta no diff: `/reject-lines Motivo`\n",
        "---\n"
    ]

    for status, filepath in diff_entries:

        # 1. Ignorado?
        if is_ignored(filepath, ignore_patterns):
            skipped_files.append(filepath)
            pr_body_lines.append(f"- ⏭️ `{filepath}` — ignorado (.templatesyncignore)")
            continue

        # 2. Ficheiro eliminado no template (status='A' do ponto de vista filho→template
        #    significa que existe no template mas não no filho, i.e. novo;
        #    status='D' significa que existe no filho mas não no template, i.e. deletado no template)
        #
        # git diff HEAD template/main:
        #   A = adicionado no template (novo para o filho)
        #   D = existe no filho, não no template  → foi deletado no template
        #   M = modificado
        if status == "D":
            # Só existe no filho. Não é uma mudança do template, é ficheiro local.
            only_in_child.append(filepath)
            pr_body_lines.append(f"- 🆕 `{filepath}` — só existe neste repo, sem alterações")
            continue

        # 3. Ficheiro adicionado no template (A) ou modificado (M):
        #    verificar se foi eliminado no template
        #    (A partir daqui o ficheiro EXISTE no template)
        # Caso especial: ficheiro existia no filho e foi apagado no template
        # Isto não pode acontecer aqui porque status='D' já foi tratado acima.
        # Status 'A' significa novo no template (não existia no filho).

        # 4. Ficheiro completamente rejeitado?
        if filepath in rejected and not rejected[filepath].get("rejected_hunks"):
            skipped_files.append(filepath)
            reason = rejected[filepath].get('reason', 'n/a')
            pr_body_lines.append(f"- 🚫 `{filepath}` — rejeitado (razão: {reason})")
            continue

        # 5. Status 'A': ficheiro novo no template, não existe no filho → copiar directo
        if status == "A":
            _, err = run_safe(f"git checkout template/main -- '{filepath}'")
            if err:
                pr_body_lines.append(f"- ❌ `{filepath}` — erro ao copiar ficheiro novo")
            else:
                accepted_files.append(filepath)
                pr_body_lines.append(f"- ➕ `{filepath}` — ficheiro novo adicionado")
            continue

        # 6. Ficheiro modificado (M): analisar hunk a hunk
        diff = get_file_diff(filepath)
        diff_header, hunks = parse_hunks(diff)
        file_rejections = rejected.get(filepath, {})
        accepted_hunks  = []
        rejected_hunks_found = []

        for hunk in hunks:
            if hunk_is_rejected(hunk, file_rejections):
                rejected_hunks_found.append(hunk)
            else:
                accepted_hunks.append(hunk)

        if not accepted_hunks:
            # Todos os hunks rejeitados → ignorar ficheiro
            skipped_files.append(filepath)
            pr_body_lines.append(f"- 🚫 `{filepath}` — todos os hunks rejeitados")

        elif not rejected_hunks_found:
            # Nenhum hunk rejeitado → aplicar ficheiro inteiro
            _, err = run_safe(f"git checkout template/main -- '{filepath}'")
            if err:
                pr_body_lines.append(f"- ❌ `{filepath}` — erro inesperado ao aplicar")
            else:
                accepted_files.append(filepath)
                pr_body_lines.append(f"- ✅ `{filepath}` — atualizado na íntegra")

        else:
            # Aplicação PARCIAL: aplica só os hunks aceites
            ok = apply_partial_hunks(filepath, diff_header, accepted_hunks)
            if ok:
                partial_files.append(filepath)
                pr_body_lines.append(
                    f"- ⚠️ `{filepath}` — {len(accepted_hunks)} hunk(s) aceite(s), "
                    f"{len(rejected_hunks_found)} rejeitado(s) — aplicação parcial OK"
                )
            else:
                pr_body_lines.append(
                    f"- ❌ `{filepath}` — aplicação parcial falhou, revisão manual necessária"
                )

    # Ficheiros 'D' (deleted in template) que não estejam em .templatesyncignore
    # e não estejam completamente rejeitados: eliminar do filho
    for status, filepath in diff_entries:
        if status != "D":
            continue
        if is_ignored(filepath, ignore_patterns):
            continue
        # Se foi rejeitado (ficheiro completo), mantém-se no filho
        if filepath in rejected and not rejected[filepath].get("rejected_hunks"):
            pr_body_lines.append(f"- 📁 `{filepath}` — eliminado no template, mas mantido (rejeição manual)")
            continue
        # ... ja tratado em only_in_child acima; não fazer nada extra
        # (ficheiros só no filho não são apagados automaticamente)

    # NOVO: ficheiros que existem no filho MAS não no template E não estão
    # em .templatesyncignore E não estão em sync-rejected → propor eliminação
    # Para isso, comparar lista de ficheiros tracked:
    template_files_out, _ = run_safe("git ls-tree -r --name-only template/main")
    child_files_out,    _ = run_safe("git ls-tree -r --name-only HEAD")
    template_files = set((template_files_out or "").splitlines())
    child_files    = set((child_files_out    or "").splitlines())

    deleted_in_template = child_files - template_files

    for filepath in sorted(deleted_in_template):
        if is_ignored(filepath, ignore_patterns):
            continue
        if filepath in rejected and not rejected[filepath].get("rejected_hunks"):
            pr_body_lines.append(f"- 📁 `{filepath}` — eliminado no template, mantido (rejeição manual)")
            continue
        # Apagar do working tree
        _, err = run_safe(f"git rm --force '{filepath}'")
        if err:
            pr_body_lines.append(f"- ❌ `{filepath}` — erro ao eliminar")
        else:
            deleted_files.append(filepath)
            pr_body_lines.append(f"- 🗑️ `{filepath}` — eliminado (removido do template)")

    has_changes = bool(accepted_files or partial_files or deleted_files)
    summary = (
        f"{len(accepted_files)} atualizado(s), "
        f"{len(partial_files)} parcial(is), "
        f"{len(deleted_files)} eliminado(s), "
        f"{len(skipped_files)} ignorado(s)"
    )

    print(f"\nResultado: {summary}")
    _write_outputs(has_changes, summary, "\n".join(pr_body_lines))


def _write_outputs(has_changes: bool, summary: str, pr_body: str):
    github_output = os.environ.get("GITHUB_OUTPUT", "")
    if github_output:
        with open(github_output, "a") as out:
            out.write(f"has_changes={'true' if has_changes else 'false'}\n")
            out.write(f"summary={summary}\n")
            out.write("pr_body<<EOF\n")
            out.write(pr_body + "\n")
            out.write("EOF\n")


if __name__ == "__main__":
    main()
