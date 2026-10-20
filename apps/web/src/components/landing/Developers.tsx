import Link from "next/link";
import { listOperations, type Operation } from "@/components/developers/operations";
import { Code, CodeBlock } from "@/components/ui/CodeBlock";
import { Tabs } from "@/components/ui/Tabs";
import { getApiExample } from "./loaders";

/** Reads first, then the calls that need a token. */
const ORDER = ["tabulate", "listElections", "getElection", "getPollResults", "getPollCvr", "getPoll", "createPoll", "closePoll"];

function rank(op: Operation): number {
  const i = ORDER.indexOf(op.operationId);
  return i < 0 ? ORDER.length : i;
}

/** "Count anything over HTTP": the endpoints from the OpenAPI document and a real tabulate call. */
export async function Developers() {
  const example = await getApiExample();
  const operations = listOperations().sort((a, b) => rank(a) - rank(b));
  const curl = [
    "# RECOUNT_URL is this site's address, for example http://localhost:3000",
    'curl -X POST "$RECOUNT_URL/api/v1/tabulate" \\',
    '  -H "Content-Type: application/json" \\',
    `  -d '${example.body.replace(/\n/g, "\n  ")}'`,
  ].join("\n");

  return (
    <section className="lp-sec lp-sec-deep" id="developers" aria-labelledby="developers-h">
      <div className="wrap grid12 lp-dev">
        <div className="lp-dev-copy">
          <h2 className="display lp-h2" id="developers-h">
            Count anything over HTTP
          </h2>
          <p className="lp-lede">
            The engine behind every page is a plain JSON API. Send ballots, get rounds, transfers and the Condorcet check back. Nothing you send is
            stored.
          </p>
          <ul className="lp-endpoints">
            {operations.map((op) => (
              <li key={`${op.method} ${op.path}`}>
                <span className={op.method === "get" ? "lp-verb" : "lp-verb is-post"}>{op.method.toUpperCase()}</span>
                <code>{op.url}</code>
                <span>
                  {op.summary}
                  {op.auth === "required" ? " (token)" : ""}
                </span>
              </li>
            ))}
            <li>
              <span className="lp-verb">GET</span>
              <code>/api/v1/openapi.json</code>
              <span>This list as an OpenAPI 3.1 document</span>
            </li>
          </ul>
          <p className="lp-dev-more">
            <Link href="/developers">Every parameter and response, with examples</Link>
          </p>
        </div>
        <div className="lp-dev-code">
          <Tabs
            label="Example"
            tone="dark"
            tabs={[
              { id: "request", label: "Request", panel: <CodeBlock code={curl} language="shell" label="Example request" className="lp-dev-block" /> },
              {
                id: "response",
                label: "Response",
                panel: <CodeBlock code={example.response} language="json" label="The response, counted by the engine" className="lp-dev-block" />,
              },
            ]}
          />
          <p className="lp-code-note">
            The response is the engine&apos;s count of these ballots, worked out when this page was built. Add <Code>?format=rctab</Code> to get the
            same count as an RCTab summary. Votes are decimal strings, so fractional STV transfers stay exact.
          </p>
        </div>
      </div>
    </section>
  );
}
