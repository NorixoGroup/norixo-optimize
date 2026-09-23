"use client";

import { useEffect, useState } from "react";
import { getSharedSession } from "@/lib/supabase/sharedAuth";
import { getStoredWorkspaceId } from "@/lib/workspaces/getStoredWorkspaceId";
import { isActionableLinkedInProfileUrl } from "@/lib/backlinks/services/contactValidationService";

type Props = {
  outreachId: string;
  contactName: string;
  linkedinUrl: string | null;
  message: string | null;
  onClose(): void;
  onChanged(): void;
};

type AiProposal = {
  reply: string;
  tone: string;
  language: string;
  warnings: string[];
};

async function authenticatedApiRequest(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const { data } = await getSharedSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("Session administrateur introuvable.");
  }

  const workspaceId = getStoredWorkspaceId()?.trim();
  const headers = new Headers(init?.headers);

  headers.set("Authorization", "Bearer " + accessToken);
  headers.set("Content-Type", "application/json");

  if (workspaceId) {
    headers.set("X-Norixo-Workspace-Id", workspaceId);
  }

  return fetch(path, {
    ...init,
    cache: "no-store",
    headers,
  });
}

export default function OutreachLinkedInInteractionDialog(p: Props) {
  const [state, setState] = useState("none");
  const [events, setEvents] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const [inboundText, setInboundText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProposal, setAiProposal] = useState<AiProposal | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

  const load = async () => {
    const response = await authenticatedApiRequest(
      "/api/backlinks/outreach/" +
        p.outreachId +
        "/linkedin-interactions",
    );

    const data = await response.json();

    if (response.ok) {
      setState(data.state);
      setEvents(data.interactions ?? []);
    }
  };

  useEffect(() => {
    setInboundText("");
    setAiProposal(null);
    setAiError(null);
    setReplyError(null);
    void load();
  }, [p.outreachId]);

  const postInteraction = async (
    path: string,
    body: Record<string, unknown> = {},
  ) => {
    setBusy(true);

    try {
      const response = await authenticatedApiRequest(
        "/api/backlinks/outreach/" +
          p.outreachId +
          "/linkedin-interactions/" +
          path,
        {
          method: "POST",
          body: JSON.stringify({
            ...body,
            confirm: true,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("LinkedIn interaction unavailable.");
      }

      await load();
      p.onChanged();
    } finally {
      setBusy(false);
    }
  };

  const requestAiProposal = async () => {
    const textBody = inboundText.trim();

    if (!textBody || aiBusy) {
      return;
    }

    setAiBusy(true);
    setAiError(null);
    setAiProposal(null);

    try {
      const response = await authenticatedApiRequest(
        "/api/backlinks/outreach/" +
          p.outreachId +
          "/reply-assistant",
        {
          method: "POST",
          body: JSON.stringify({
            inbound: {
              sender: p.contactName || null,
              subject: null,
              textBody,
            },
          }),
        },
      );

      const data = await response.json();

      if (
        !response.ok ||
        typeof data?.proposal?.reply !== "string" ||
        typeof data?.proposal?.tone !== "string" ||
        typeof data?.proposal?.language !== "string" ||
        data?.proposal?.approvalRequired !== true ||
        !Array.isArray(data?.proposal?.warnings) ||
        !data.proposal.warnings.every(
          (warning: unknown) => typeof warning === "string",
        )
      ) {
        throw new Error("Reply proposal unavailable.");
      }

      setAiProposal({
        reply: data.proposal.reply,
        tone: data.proposal.tone,
        language: data.proposal.language,
        warnings: data.proposal.warnings,
      });
    } catch {
      setAiError("La proposition IA est indisponible.");
    } finally {
      setAiBusy(false);
    }
  };

  const confirmReply = async (
    classification: "positive" | "negative",
  ) => {
    if (busy) {
      return;
    }

    const confirmation =
      classification === "positive"
        ? "Confirmer que cette réponse LinkedIn est positive ?"
        : "Confirmer que cette réponse LinkedIn est négative ? Cette action clôturera l’outreach comme refusé.";

    if (!window.confirm(confirmation)) {
      return;
    }

    setReplyError(null);

    try {
      await postInteraction("reply-confirmed", {
        classification,
      });
    } catch {
      setReplyError(
        "Impossible de confirmer cette réponse LinkedIn.",
      );
    }
  };

  const replyEntryAvailable = state === "message_sent";
  const replyAlreadyConfirmed = state === "reply_confirmed";
  const actionableLinkedInUrl = p.linkedinUrl != null && isActionableLinkedInProfileUrl(p.linkedinUrl)
    ? p.linkedinUrl
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6"
      >
        <h2 className="text-lg font-semibold">
          Gérer le contact LinkedIn
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          Norixo n’envoie rien automatiquement. {p.contactName}
          {actionableLinkedInUrl ? <> · <a href={actionableLinkedInUrl} target="_blank" rel="noopener noreferrer" className="underline">{actionableLinkedInUrl}</a></> : p.linkedinUrl ? ` · ${p.linkedinUrl}` : ""}
        </p>

        {!actionableLinkedInUrl ? (
          <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Un profil LinkedIn individuel au format /in/ est requis avant de pouvoir enregistrer une invitation ou un message.
          </p>
        ) : null}

        {actionableLinkedInUrl && state === "none" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "Invitation envoyée manuellement ?",
                )
              ) {
                void postInteraction("invitation-sent");
              }
            }}
          >
            J’ai envoyé l’invitation
          </button>
        ) : null}

        {actionableLinkedInUrl && state === "invitation_pending" ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Connexion acceptée ?")) {
                  void postInteraction("connection-status", {
                    status: "connection_accepted",
                  });
                }
              }}
            >
              Connexion acceptée
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Connexion refusée ?")) {
                  void postInteraction("connection-status", {
                    status: "connection_rejected",
                  });
                }
              }}
            >
              Connexion refusée
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Invitation retirée ?")) {
                  void postInteraction("connection-status", {
                    status: "connection_withdrawn",
                  });
                }
              }}
            >
              Invitation retirée
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Invitation expirée ?")) {
                  void postInteraction("connection-status", {
                    status: "connection_expired",
                  });
                }
              }}
            >
              Invitation expirée
            </button>
          </div>
        ) : null}

        {actionableLinkedInUrl && state === "connection_accepted" ? (
          <div className="mt-4">
            <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm">
              {p.message}
            </pre>

            <button
              type="button"
              disabled={busy || !p.message}
              onClick={() => {
                if (
                  window.confirm(
                    "Message complet envoyé manuellement ?",
                  )
                ) {
                  void postInteraction("message-sent");
                }
              }}
            >
              J’ai envoyé le message
            </button>
          </div>
        ) : null}

        {actionableLinkedInUrl && replyEntryAvailable ? (
          <div className="mt-6 rounded-2xl border border-slate-200 p-4">
            <h3 className="font-semibold">
              Réponse reçue sur LinkedIn
            </h3>

            <p className="mt-1 text-sm text-slate-600">
              Collez ici la réponse reçue. Le texte sert uniquement
              à préparer la proposition IA et n’est pas enregistré
              par la confirmation LinkedIn.
            </p>

            <textarea
              value={inboundText}
              onChange={(event) => {
                setInboundText(event.target.value);
                setAiProposal(null);
                setAiError(null);
              }}
              rows={6}
              placeholder="Collez la réponse LinkedIn reçue…"
              className="mt-3 w-full rounded-xl border border-slate-300 p-3 text-sm"
            />

            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={aiBusy || !inboundText.trim()}
                onClick={() => void requestAiProposal()}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {aiBusy
                  ? "Génération…"
                  : "Proposer une réponse avec l’IA"}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmReply("positive")}
                className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                Confirmer positive
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmReply("negative")}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Confirmer négative
              </button>
            </div>

            {aiProposal ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">
                  Proposition IA · {aiProposal.language} ·{" "}
                  {aiProposal.tone}
                </p>

                <p className="mt-2 whitespace-pre-wrap">
                  {aiProposal.reply}
                </p>

                {aiProposal.warnings.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5 text-xs text-amber-700">
                    {aiProposal.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}

                <p className="mt-2 text-xs text-slate-500">
                  Proposition uniquement — vérifiez-la avant de
                  répondre.
                </p>
              </div>
            ) : null}

            {aiError ? (
              <p role="alert" className="mt-2 text-sm text-rose-700">
                {aiError}
              </p>
            ) : null}

            {replyError ? (
              <p role="alert" className="mt-2 text-sm text-rose-700">
                {replyError}
              </p>
            ) : null}
          </div>
        ) : null}

        {replyAlreadyConfirmed ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
            Réponse LinkedIn confirmée.
          </p>
        ) : null}

        <h3 className="mt-6 font-semibold">Historique</h3>

        {events.length === 0 ? (
          <p>Aucune interaction LinkedIn enregistrée.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {events.map((event) => (
              <li key={event.id}>
                {(
                  {
                    connection_invitation_sent:
                      "Invitation LinkedIn envoyée",
                    connection_accepted:
                      "Connexion LinkedIn acceptée",
                    connection_rejected:
                      "Connexion LinkedIn refusée",
                    connection_withdrawn:
                      "Invitation LinkedIn retirée",
                    connection_expired:
                      "Invitation LinkedIn expirée",
                    message_sent:
                      "Message LinkedIn envoyé",
                    reply_confirmed:
                      "Réponse LinkedIn confirmée",
                  } as Record<string, string>
                )[event.interaction_type] ??
                  event.interaction_type}
                {" · "}
                {new Date(event.occurred_at).toLocaleString("fr-FR")}
                {event.target_profile_url
                  ? ` · ${event.target_profile_url}`
                  : ""}
                {event.evidence_reference
                  ? ` · ${event.evidence_reference}`
                  : ""}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={p.onClose}
          className="mt-6"
        >
          Fermer
        </button>
      </section>
    </div>
  );
}
