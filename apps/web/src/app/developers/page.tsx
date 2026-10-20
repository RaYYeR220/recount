import type { Metadata } from "next";
import Link from "next/link";
import { OperationCard, SchemaCard, opAnchor } from "@/components/developers/ApiReference";
import { getDeveloperExamples } from "@/components/developers/loaders";
import { API_BASE, listOperations, listSchemas } from "@/components/developers/operations";
import { Code, CodeBlock } from "@/components/ui/CodeBlock";
import { MAX_BODY_BYTES } from "@/server/http";
import { LIMITS } from "@/server/rateLimit";

export const metadata: Metadata = {
  title: "Developers",
  description: "The Recount API, endpoint by endpoint, from its OpenAPI 3.1 document; API tokens; and the @recount/engine package.",
};

const ERROR_EXAMPLE = `{ "error": { "code": "not_found", "message": "Not found" } }`;

export default async function DevelopersPage() {
  const operations = listOperations();
  const schemas = listSchemas();
  const { tabulateResponse, engine } = await getDeveloperExamples();
  const tabulate = LIMITS.tabulate;

  return (
    <div className="wrap page dev-page">
      <h1 className="display page-title">Developers</h1>
      <p className="page-desc">
        Everything Recount counts is a JSON API under <Code>{API_BASE}</Code>, described by an OpenAPI 3.1 document at{" "}
        <a href="/api/v1/openapi.json">/api/v1/openapi.json</a>. This page is rendered from that same document, so it lists exactly what the
        server answers.
      </p>

      <div className="dev-layout">
        <nav className="dev-nav" aria-label="On this page">
          <p className="dev-nav-h">On this page</p>
          <ul>
            <li>
              <a href="#basics">Basics</a>
            </li>
            <li>
              <a href="#tokens">API tokens</a>
            </li>
            <li>
              <a href="#endpoints">Endpoints</a>
              <ul>
                {operations.map((op) => (
                  <li key={op.operationId}>
                    <a href={`#${opAnchor(op)}`}>
                      <span className="dev-nav-verb">{op.method.toUpperCase()}</span> {op.path}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
            <li>
              <a href="#schemas">Schemas</a>
            </li>
            <li>
              <a href="#engine">The engine</a>
            </li>
          </ul>
        </nav>

        <div className="dev-main">
          <section className="dev-section" id="basics" aria-labelledby="basics-h">
            <h2 className="title" id="basics-h">
              Basics
            </h2>
            <ul className="dev-facts">
              <li>
                Requests and responses are JSON. Bodies are capped at {MAX_BODY_BYTES.toLocaleString("en-US")} bytes.
              </li>
              <li>
                Vote figures are decimal strings, <Code>&quot;7&quot;</Code> or <Code>&quot;1.8000&quot;</Code>, so fractional STV transfers stay
                exact.
              </li>
              <li>
                <Code>POST /tabulate</Code> stores nothing and allows {tabulate.limit} calls a minute per address.
              </li>
              <li>
                A poll you may not see answers exactly like one that does not exist: <Code>404</Code>.
              </li>
              <li>Errors share one shape:</li>
            </ul>
            <CodeBlock code={ERROR_EXAMPLE} language="json" label="Error response" />
          </section>

          <section className="dev-section" id="tokens" aria-labelledby="tokens-h">
            <h2 className="title" id="tokens-h">
              API tokens
            </h2>
            <p>
              Creating and closing polls needs a personal token. Make one in <Link href="/settings">Settings</Link>: it starts with{" "}
              <Code>rk_</Code> and is shown once, so copy it then. Send it as a bearer token. Results and cast-vote records take one optionally: with
              it, an owner reads results that are hidden from everyone else. A token that does not match answers <Code>401</Code>, even where none
              is needed.
            </p>
            <CodeBlock code={'export RECOUNT_TOKEN=rk_…\ncurl -H "Authorization: Bearer $RECOUNT_TOKEN" …'} language="shell" label="Sending a token" />
          </section>

          <section className="dev-section" id="endpoints" aria-labelledby="endpoints-h">
            <h2 className="title" id="endpoints-h">
              Endpoints
            </h2>
            <p>
              Examples point at seeded polls and elections, so the reads answer for real. Examples use this site&apos;s address; a token goes in{" "}
              <Code>$RECOUNT_TOKEN</Code>.
            </p>
            {operations.map((op) => (
              <OperationCard
                key={op.operationId}
                op={op}
                example={op.operationId === "tabulate" ? { label: "Response (counted by the engine when this page was built)", code: tabulateResponse } : undefined}
              />
            ))}
          </section>

          <section className="dev-section" id="schemas" aria-labelledby="schemas-h">
            <h2 className="title" id="schemas-h">
              Schemas
            </h2>
            <p>Named shapes the endpoints refer to. Open one to see its fields.</p>
            {schemas.map(({ name, schema }) => (
              <SchemaCard key={name} name={name} schema={schema} />
            ))}
          </section>

          <section className="dev-section" id="engine" aria-labelledby="engine-h">
            <h2 className="title" id="engine-h">
              The engine
            </h2>
            <p>
              The count behind every page is <Code>@recount/engine</Code>, a workspace package (<Code>packages/engine</Code>, MIT): IRV and STV with
              RCTab&apos;s rule options, exact fixed-point arithmetic, and no dependencies. <Code>tabulate</Code> counts,{" "}
              <Code>presetRules</Code> picks a jurisdiction&apos;s rules and <Code>toRctabSummary</Code> writes the RCTab report. The comments
              below are what this program prints; they were filled in by running it.
            </p>
            <CodeBlock code={engine.code} language="text" label="Counting the lunch vote with @recount/engine" />
            <p className="dev-note">
              Presets: {engine.presets.map((p, i) => (
                <span key={p}>
                  {i > 0 ? ", " : ""}
                  <Code>{p}</Code>
                </span>
              ))}
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
