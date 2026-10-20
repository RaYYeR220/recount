import { Badge } from "@/components/ui/Badge";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Curl } from "./Curl";
import { refName, type Operation, type Schema } from "./operations";
import { limitsOf, typeOf } from "./schemaText";

export const opAnchor = (op: Operation) => `op-${op.operationId}`;
export const schemaAnchor = (name: string) => `schema-${name}`;

/** A type, linking to its schema when it is one. */
export function TypeRef({ schema }: { schema: Schema | undefined }) {
  const text = typeOf(schema);
  const ref = schema?.$ref ?? schema?.items?.$ref;
  if (ref) {
    const name = refName(ref);
    return (
      <a href={`#${schemaAnchor(name)}`} className="mono dev-type">
        {text}
      </a>
    );
  }
  return <span className="mono dev-type">{text}</span>;
}

function Content({ content }: { content: Record<string, { schema: Schema }> | undefined }) {
  if (!content) return null;
  return (
    <>
      {Object.entries(content).map(([mime, { schema }]) => (
        <span key={mime} className="dev-content">
          <span className="dev-mime">{mime}</span> <TypeRef schema={schema} />
        </span>
      ))}
    </>
  );
}

const AUTH = {
  required: <Badge tone="gilt">Token required</Badge>,
  optional: <Badge tone="neutral" onDark>Token optional</Badge>,
  none: <Badge tone="neutral" onDark>No token</Badge>,
} as const;

/** One endpoint: what it does, its parameters, body and responses, and a curl line against this site. */
export function OperationCard({ op, example }: { op: Operation; example?: { label: string; code: string } }) {
  return (
    <article className="dev-op" id={opAnchor(op)} aria-labelledby={`${opAnchor(op)}-h`}>
      <header className="dev-op-head">
        <h3 id={`${opAnchor(op)}-h`} className="dev-op-title">
          <span className={op.method === "get" ? "lp-verb" : "lp-verb is-post"}>{op.method.toUpperCase()}</span>{" "}
          <code>{op.url}</code>
        </h3>
        {AUTH[op.auth]}
      </header>
      <p className="dev-op-summary">{op.summary}.</p>
      {op.description ? <p className="dev-op-desc">{op.description}</p> : null}

      <div className="dev-op-grid">
        <div className="dev-op-spec">
          {op.parameters.length > 0 ? (
            <section>
              <h4>Parameters</h4>
              <table className="dev-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">In</th>
                    <th scope="col">Type</th>
                    <th scope="col">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {op.parameters.map((p) => (
                    <tr key={`${p.in}-${p.name}`}>
                      <th scope="row" className="mono">
                        {p.name}
                        {p.required ? <span className="dev-req"> required</span> : null}
                      </th>
                      <td>{p.in}</td>
                      <td>
                        <TypeRef schema={p.schema} />
                      </td>
                      <td>{p.description ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {op.requestBody ? (
            <section>
              <h4>Request body{op.requestBody.required ? "" : " (optional)"}</h4>
              <p>
                <Content content={op.requestBody.content} />
              </p>
              {op.requestBody.description ? <p className="dev-note">{op.requestBody.description}</p> : null}
            </section>
          ) : null}

          <section>
            <h4>Responses</h4>
            <ul className="dev-responses">
              {op.responses.map((r) => (
                <li key={r.status}>
                  <span className={r.status.startsWith("2") ? "dev-status is-ok" : "dev-status"}>{r.status}</span>
                  <span>
                    {r.description}
                    {r.content ? (
                      <>
                        {": "}
                        <Content content={r.content} />
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="dev-op-example">
          <h4>Example</h4>
          <Curl op={op} />
          {example ? (
            <>
              <h4>{example.label}</h4>
              <CodeBlock code={example.code} language="json" label={example.label} className="dev-response" />
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** A named schema's top-level properties. */
export function SchemaCard({ name, schema }: { name: string; schema: Schema }) {
  const props = Object.entries(schema.properties ?? {});
  const required = new Set(schema.required ?? []);
  return (
    <details className="dev-schema" id={schemaAnchor(name)}>
      <summary>
        <span className="mono">{name}</span>
        <span className="dev-schema-type">{props.length > 0 ? `${props.length} fields` : typeOf(schema)}</span>
      </summary>
      {schema.description ? <p className="dev-note">{schema.description}</p> : null}
      {props.length > 0 ? (
        <table className="dev-table">
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Type</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {props.map(([field, s]) => (
              <tr key={field}>
                <th scope="row" className="mono">
                  {field}
                  {required.has(field) ? <span className="dev-req"> required</span> : null}
                </th>
                <td>
                  <TypeRef schema={s} />
                </td>
                <td>{[s.description, ...limitsOf(s)].filter(Boolean).join("; ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </details>
  );
}
