-- ================================================
-- Migration 0013 — Fidelização por serviço
-- Adiciona coluna conta_fidelizacao à tabela servicos
-- e substitui o trigger tr_reserva_concluida_increment
-- para que serviços excluídos não incrementem o contador.
-- ================================================

-- 1. Nova coluna na tabela servicos
--    DEFAULT 1 → todos os serviços existentes continuam a contar
ALTER TABLE servicos ADD COLUMN conta_fidelizacao INTEGER NOT NULL DEFAULT 1;

-- 2. Dropar o trigger antigo (sem verificação de serviço)
DROP TRIGGER IF EXISTS tr_reserva_concluida_increment;

-- 3. Novo trigger com verificação de conta_fidelizacao
--    Só incrementa reservas_concluidas se o serviço da reserva
--    tiver conta_fidelizacao = 1.
CREATE TRIGGER tr_reserva_concluida_increment
AFTER UPDATE ON reservas FOR EACH ROW
WHEN NEW.status = 'concluida' AND OLD.status != 'concluida'
BEGIN
  UPDATE clientes
  SET reservas_concluidas = reservas_concluidas + 1,
      last_appointment_date = NEW.data_hora,
      atualizado_em = CURRENT_TIMESTAMP
  WHERE id = NEW.cliente_id
    AND (SELECT conta_fidelizacao FROM servicos WHERE id = NEW.servico_id) = 1;

  -- Atualizar last_appointment_date mesmo que o serviço não conte para fidelização
  UPDATE clientes
  SET last_appointment_date = NEW.data_hora,
      atualizado_em = CURRENT_TIMESTAMP
  WHERE id = NEW.cliente_id
    AND (SELECT conta_fidelizacao FROM servicos WHERE id = NEW.servico_id) != 1;
END;
