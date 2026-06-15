import { getTranslations } from "next-intl/server";
import { requireArea } from "@/lib/session";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { listUsers, listInvitations, accountOptions } from "@/modules/admin/queries";
import { invitationStatus } from "@/lib/invitations";
import { InviteUserForm } from "@/modules/admin/invite-user-form";
import { UsersTable } from "@/modules/admin/users-table";
import { RevokeButton } from "@/modules/admin/invitations-list";

export default async function UsersPage() {
  const { session } = await requireArea("admin");
  const t = await getTranslations("admin");
  const [users, invites, accounts] = await Promise.all([listUsers(), listInvitations(), accountOptions()]);

  const statusLabel: Record<string, string> = {
    valid: t("invStatusValid"),
    expired: t("invStatusExpired"),
    used: t("invStatusUsed"),
  };

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-slate-900">{t("usersTitle")}</h1>

      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("inviteUser")}</span></CardHeader>
        <CardBody><InviteUserForm accounts={accounts} /></CardBody>
      </Card>

      {users.length === 0 ? (
        <p className="text-sm text-slate-500">{t("noUsers")}</p>
      ) : (
        <UsersTable users={users} currentUserId={session.user.id} />
      )}

      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("pendingInvitations")}</span></CardHeader>
        <CardBody>
          {invites.length === 0 ? (
            <p className="text-sm text-slate-400">{t("noInvitations")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-1">{t("email")}</th>
                  <th className="py-1">{t("role")}</th>
                  <th className="py-1">{t("account")}</th>
                  <th className="py-1">{t("status")}</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => {
                  const state = invitationStatus({ expiresAt: inv.expiresAt, acceptedAt: inv.acceptedAt });
                  return (
                    <tr key={inv.id} className="border-t border-slate-100">
                      <td className="py-1.5">{inv.email}</td>
                      <td className="py-1.5">{t(`role${inv.role.charAt(0).toUpperCase()}${inv.role.slice(1)}`)}</td>
                      <td className="py-1.5 text-slate-500">{inv.accountTitle ?? "—"}</td>
                      <td className="py-1.5 text-slate-500">{statusLabel[state]}</td>
                      <td className="py-1.5 text-right">{state === "valid" ? <RevokeButton id={inv.id} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
