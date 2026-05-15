import { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    forgotPassword: {
      generateEmailSubject: () => 'Jelszó visszaállítás — Bookly',
      generateEmailHTML: (args?: { token?: string }) => {
        const token = args?.token ?? ''
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
        const resetUrl = `${appUrl}/bookly/reset-password?token=${token}`
        return `<!DOCTYPE html>
<html lang="hu">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#09090b;padding:24px 32px">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td><span style="color:#fff;font-size:18px;font-weight:900;letter-spacing:-0.5px">Bookly</span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#0099ff;margin-left:4px;vertical-align:middle"></span></td>
              <td align="right"><a href="https://davelopment.hu" style="color:#52525b;font-size:11px;text-decoration:none">by [davelopment]®</a></td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="background:#fff;padding:32px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding-bottom:24px">
                <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:#0099ff18;margin-bottom:12px">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0099ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="11" height="11" x="11" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                </div>
                <h1 style="margin:8px 0 4px;font-size:22px;font-weight:900;color:#09090b;letter-spacing:-0.5px">Jelszó visszaállítás</h1>
                <p style="margin:0;color:#71717a;font-size:14px">Kattints az alábbi gombra az új jelszó beállításához.</p>
              </td></tr>
              <tr><td align="center" style="padding:8px 0 24px">
                <a href="${resetUrl}" style="display:inline-block;background:#09090b;color:#fff;padding:14px 32px;border-radius:100px;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:-0.2px">Jelszó visszaállítása</a>
              </td></tr>
              <tr><td align="center">
                <p style="margin:0;color:#a1a1aa;font-size:12px">A link 1 óráig érvényes. Ha nem te kérted, hagyd figyelmen kívül ezt az emailt.</p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#09090b;padding:20px 32px;text-align:center">
            <p style="margin:0;color:#3f3f46;font-size:11px">© 2026 Bookly · Minden jog fenntartva</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
      },
    },
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role', 'salon'],
  },
  access: {
    create: () => true,
    read: ({ req }) => {
      if (req.user?.role === 'admin') return true
      return { id: { equals: req.user?.id } }
    },
    update: ({ req }) => {
      if (req.user?.role === 'admin') return true
      return { id: { equals: req.user?.id } }
    },
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Teljes név',
    },
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Szalon tulajdonos', value: 'salon_owner' },
        { label: 'Admin', value: 'admin' },
      ],
      defaultValue: 'salon_owner',
      required: true,
      access: {
        create: ({ req }) => req.user?.role === 'admin',
        update: ({ req }) => req.user?.role === 'admin',
      },
    },
    {
      name: 'salon',
      type: 'relationship',
      relationTo: 'salons',
      hasMany: false,
      admin: {
        condition: (data) => data?.role === 'salon_owner',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Aktív', value: 'active' },
        { label: 'Deaktivált', value: 'inactive' },
      ],
      defaultValue: 'active',
    },
  ],
}
