export async function getMoloniToken(env) {
    const res = await fetch('https://api.molonion.pt/auth/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id:     env.MOLONI_CLIENT_ID,
            client_secret: env.MOLONI_CLIENT_SECRET,
            grant_type:    'client_credentials',
        }),
    })
    const data = await res.json()
    return data.access_token
}

