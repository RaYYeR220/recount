import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { logOut } from "@/components/shell/actions";
import { CreateTokenForm } from "@/components/settings/CreateTokenForm";
import { RevokeTokenButton } from "@/components/settings/RevokeTokenButton";
import { Button, Ledger, PanelHeader, Paper } from "@/components/ui";
import { formatWhen } from "@/lib/when";
import { listApiTokens } from "@/server/apiTokens";
import { getDb } from "@/server/db/client";
import { requireViewer } from "@/server/session";

export const metadata: Metadata = { title: "Settings" };

/** Token times are shown in UTC, named: the server doesn't know the reader's zone. */
const at = (date: Date) => `${formatWhen(date, "UTC", { short: true })} UTC`;

async function Settings() {
  const viewer = await requireViewer({ next: "/settings" });
  const tokens = await listApiTokens(getDb(), viewer.id);
  return (
    <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-[var(--gutter)] lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
      <Paper as="section" aria-labelledby="tokens-title">
        <PanelHeader id="tokens-title" title="API tokens" description={tokens.length === 1 ? "1 token" : `${tokens.length} tokens`} />
        <p className="mb-5 max-w-[60ch] text-sm text-ink-2">
          A token lets a script create and close your polls through the <Link href="/developers" className="font-bold underline underline-offset-4">REST API</Link>. Send it as{" "}
          <code className="code-inline">Authorization: Bearer rk_…</code>. Anyone holding it acts as you, so give each script its own and revoke the ones you no longer use.
        </p>
        <CreateTokenForm />
        {tokens.length > 0 ? (
          <div className="mt-6">
            <Ledger caption="Your API tokens" captionHidden>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Created</th>
                  <th scope="col">Last used</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr key={token.id}>
                    <th scope="row" className="min-w-[8rem] break-words">
                      {token.name}
                    </th>
                    <td className="whitespace-nowrap text-ink-2">{at(token.createdAt)}</td>
                    <td className="whitespace-nowrap text-ink-2">{token.lastUsedAt ? at(token.lastUsedAt) : "Never"}</td>
                    <td className="text-right">
                      <RevokeTokenButton id={token.id} name={token.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Ledger>
          </div>
        ) : (
          <p className="mt-6 rounded-field bg-paper-2 px-4 py-3 text-sm text-ink-3">No tokens yet. The API&apos;s read endpoints need none.</p>
        )}
      </Paper>
      <Paper as="section" aria-labelledby="account-title">
        <PanelHeader id="account-title" title="Account" />
        <dl className="m-0 grid gap-1 text-sm">
          <dt className="text-ink-3">Signed in as</dt>
          <dd className="m-0 font-bold text-ink [overflow-wrap:anywhere]">{viewer.email}</dd>
        </dl>
        <form action={logOut} className="mt-5">
          <Button type="submit" variant="line">
            Log out
          </Button>
        </form>
      </Paper>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-[var(--gutter)] lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
      <Paper padded={false} className="h-[340px]">
        <span className="sr-only">Loading…</span>
      </Paper>
      <Paper padded={false} className="h-[180px]">
        <span />
      </Paper>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="wrap page">
      <h1 className="display page-title">Settings</h1>
      <p className="page-desc">Keys for the API and your account.</p>
      <Suspense fallback={<SettingsSkeleton />}>
        <Settings />
      </Suspense>
    </div>
  );
}
