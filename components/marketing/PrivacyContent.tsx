"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { legalI18n } from "@/data/marketing/legalI18n";

const legalCopy = legalI18n.en;

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold tracking-tight text-white">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function PrivacyContent() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        Privacy Policy
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Privacy Policy
      </h1>
      <p className="mt-3 text-sm text-slate-400">Last updated: August 26, 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-7 text-slate-300">
        <p>
          This Privacy Policy explains how Norixo collects, uses, shares, and protects
          personal data when you visit our website, use the Norixo application, submit
          audit requests, create or manage workspaces, interact with billing, or use
          backlink-related features. We have written it to reflect the current production
          implementation, not an abstract future roadmap.
        </p>

        <Section title="1. Who we are">
          <p>
            For the purposes of applicable privacy laws, the data controller is{" "}
            <strong className="text-white">{legalCopy.companyNameValue}</strong>, a{" "}
            {legalCopy.legalFormValue}. Our registered office is{" "}
            {legalCopy.registeredOfficeValue.replace(/\n/g, ", ")}. You can contact us at{" "}
            <a
              className="font-medium text-orange-300 underline-offset-4 hover:underline"
              href="mailto:support@norixo.io"
            >
              support@norixo.io
            </a>
            .
          </p>
          <p>
            Norixo is operated through the Norixo brand and related digital services. For
            legal notice details, please see the{" "}
            <Link
              href="/legal"
              className="font-medium text-orange-300 underline-offset-4 hover:underline"
            >
              Legal Notice
            </Link>
            .
          </p>
        </Section>

        <Section title="2. Scope of this Privacy Policy">
          <p>
            This policy applies to our public website, the authenticated Norixo
            application, the free audit flow, audit result pages, workspace and billing
            features, listing-management tools, and backlink/outreach workflows where
            they are available. It also covers support communications and other
            interactions with us in connection with those services.
          </p>
        </Section>

        <Section title="3. Information we collect">
          <p>
            Depending on how you use Norixo, we may collect and process the following
            categories of information.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-white">Account and authentication information:</strong>{" "}
              your email address, password-managed authentication state, and identity
              information associated with your account or workspace membership.
            </li>
            <li>
              <strong className="text-white">Workspace information:</strong> workspace
              name, slug, owner or member relationship, and other workspace-scoped
              settings required to operate the product.
            </li>
            <li>
              <strong className="text-white">Listing and property information:</strong>{" "}
              listing source platform, source URL, title, city, country, price, currency,
              ratings, review counts, extracted listing data, and other property details
              that you provide or that we process for audit or optimization purposes.
            </li>
            <li>
              <strong className="text-white">Audit and analysis information:</strong>{" "}
              audit inputs, generated results, scores, score breakdowns, recommendations,
              booking or revenue-related analysis, and related result payloads.
            </li>
            <li>
              <strong className="text-white">Market intelligence information:</strong>{" "}
              market snapshots, market comparables, benchmark outputs, aggregated fact
              groups, and similar data used to build market views or reports.
            </li>
            <li>
              <strong className="text-white">Billing and transaction information:</strong>{" "}
              Stripe customer IDs, subscription IDs, checkout session IDs, payment intent
              IDs, invoice or payment status, amount, currency, plan or entitlement
              information, and billing-related metadata.
            </li>
            <li>
              <strong className="text-white">Communications and support:</strong> support
              requests, correspondence, and information you choose to send us.
            </li>
            <li>
              <strong className="text-white">Backlink and outreach information:</strong>{" "}
              contact details, domain details, campaign details, outreach history, delivery
              events, inbound messages, verification history, notes, activity, and
              related operational records.
            </li>
            <li>
              <strong className="text-white">Technical and request information:</strong>{" "}
              device and browser information, request headers, IP-related data used for
              rate limiting or request protection, and logs or diagnostics necessary to
              secure and operate the service.
            </li>
            <li>
              <strong className="text-white">Browser storage:</strong> information stored
              locally in your browser where needed for product flows, including guest
              audit drafts, workspace selection, pending audit state, and similar saved
              preferences.
            </li>
          </ul>
        </Section>

        <Section title="4. How we collect information">
          <p>We collect information in a few different ways:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>directly from you when you create an account, workspace, audit, or listing;</li>
            <li>when you use Norixo and generate new analysis, content, or workflow data;</li>
            <li>from the information you submit about listings, backlinks, campaigns, and support requests;</li>
            <li>from service providers that help us operate payments, authentication, email, hosting, or AI-assisted processing; and</li>
            <li>from technical request data needed to secure the platform and prevent abuse.</li>
          </ul>
        </Section>

        <Section title="5. How we use information">
          <p>We use personal data to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>provide and maintain Norixo;</li>
            <li>authenticate users and manage workspaces;</li>
            <li>run audits, backlink workflows, and related automation;</li>
            <li>generate and improve analysis, recommendations, and content assistance;</li>
            <li>process billing, subscriptions, and payment-related operations;</li>
            <li>send service, transactional, and account-related messages;</li>
            <li>provide support and respond to requests;</li>
            <li>protect the platform, limit abuse, and troubleshoot errors; and</li>
            <li>comply with legal, accounting, and regulatory obligations.</li>
          </ul>
        </Section>

        <Section title="6. Legal bases and grounds for processing">
          <p>
            Where GDPR or similar laws apply, we rely on one or more lawful bases
            depending on the context: performance of a contract, legitimate interests,
            legal obligations, and consent where specifically requested or required.
          </p>
          <p>
            The exact legal basis can vary by feature and by the relationship between you
            and Norixo. For example, we process account and workspace data to deliver the
            service you requested, billing information to manage payments, and certain
            technical data to keep the platform secure and reliable.
          </p>
        </Section>

        <Section title="7. AI-assisted processing">
          <p>
            Norixo uses OpenAI as a verified external AI provider for certain analysis and
            generation workflows. Depending on the feature you use, the data sent to the
            AI provider may include listing titles, descriptions, amenities, location
            information, platform context, language or locale information, visual or
            content signals, campaign context, and other information needed to produce a
            useful result.
          </p>
          <p>
            Please avoid submitting unnecessary sensitive personal information in content
            that you send to AI-assisted features. AI outputs are generated to help you
            work faster, but they should still be reviewed before publication or
            operational use.
          </p>
          <p>
            We do not make unsupported claims about provider-side model training or
            retention policies beyond what is contractually disclosed by the provider.
          </p>
        </Section>

        <Section title="8. Payments">
          <p>
            Norixo uses Stripe for checkout, subscriptions, billing, and payment
            processing. Stripe handles payment card data. Norixo does not store full
            payment card numbers or card security codes in its application database.
          </p>
          <p>
            We may store billing metadata that is necessary to manage your subscription and
            account, including Stripe customer identifiers, subscription identifiers,
            checkout session identifiers, payment intent identifiers, invoice or payment
            status, amount, currency, and plan or entitlement information.
          </p>
        </Section>

        <Section title="9. Service providers and processors">
          <p>We may share information with verified third-party providers that help us run the service:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-white">Supabase</strong> — authentication,
              database, and backend infrastructure.
            </li>
            <li>
              <strong className="text-white">Stripe</strong> — payments and billing.
            </li>
            <li>
              <strong className="text-white">Resend</strong> — transactional and service
              email.
            </li>
            <li>
              <strong className="text-white">OpenAI</strong> — AI-assisted analysis and
              generation.
            </li>
            <li>
              <strong className="text-white">Vercel</strong> — website and application
              hosting and delivery.
            </li>
          </ul>
          <p>
            Some providers may process data in countries or regions where they or their
            infrastructure operate. Where required, we rely on appropriate safeguards for
            cross-border transfers.
          </p>
        </Section>

        <Section title="10. Aggregated and de-identified information">
          <p>
            Norixo processes aggregated or de-identified information where applicable,
            including market intelligence and benchmark data. For example, the repository
            includes an aggregated facts table named{" "}
            <strong className="text-white">anonymous_fact_groups</strong>. We use
            cautious terminology here because the implementation supports aggregation and
            de-identification workflows, but not every upstream data source is guaranteed
            to be irreversibly anonymous in every context.
          </p>
        </Section>

        <Section title="11. Cookies and browser storage">
          <p>
            Norixo uses browser storage where required for product functionality, including
            localStorage and sessionStorage for guest audit drafts, workspace selection or
            settings, and pending audit flows. Some authentication or integration flows
            also rely on cookies or cookie-like browser state for legitimate security
            purposes.
          </p>
          <p>
            We do not claim that Norixo uses no cookies at all, and we do not claim the
            presence of a verified mainstream advertising analytics tracker. We also do not
            present simulated tools as if they were active analytics processors.
          </p>
        </Section>

        <Section title="12. Security">
          <p>
            We use reasonable technical and organizational measures to protect the data we
            process. These include authenticated access, workspace authorization, row-level
            access controls where appropriate, server-side secret handling, Stripe webhook
            verification, and request rate limiting for public-facing flows.
          </p>
          <p>
            No online system can be guaranteed perfectly secure, but we work to reduce risk
            and to limit access to data on a need-to-know basis.
          </p>
        </Section>

        <Section title="13. Data retention">
          <p>
            We do not use a fixed one-size-fits-all retention timer. Instead, we retain
            personal data only for as long as reasonably necessary for purposes such as
            providing Norixo, maintaining accounts and workspaces, delivering audits,
            managing billing and accounting, supporting security and fraud prevention,
            resolving disputes, and complying with legal obligations.
          </p>
          <p>
            Where appropriate, data may be deleted or anonymized once it is no longer
            needed. Some records may need to be retained for longer periods where required
            by law, accounting rules, fraud-prevention needs, dispute handling, or other
            legitimate business-record purposes.
          </p>
        </Section>

        <Section title="14. International processing">
          <p>
            Because we rely on third-party service providers, your data may be processed in
            countries or regions where those providers or their infrastructure operate.
            We do not claim that all data is stored in a single country or region.
          </p>
          <p>
            Where cross-border processing requires safeguards under applicable law, we rely
            on appropriate contractual or organizational measures as needed.
          </p>
        </Section>

        <Section title="15. Your privacy rights">
          <p>
            Depending on where you live and which law applies, you may have rights such as
            access, correction, deletion, portability, objection, restriction, and
            withdrawal of consent where consent is the applicable legal basis.
          </p>
          <p>
            At present, Norixo does not provide verified self-service tools for account
            deletion, personal-data export, objection, restriction, or consent withdrawal.
            Requests are handled by contact rather than by an automated privacy dashboard.
          </p>
          <p>
            To exercise a privacy right or ask a question, contact us at{" "}
            <a
              className="font-medium text-orange-300 underline-offset-4 hover:underline"
              href="mailto:support@norixo.io"
            >
              support@norixo.io
            </a>
            .
          </p>
        </Section>

        <Section title="16. Account, listing, and audit deletion">
          <p>
            Listings can be soft-deleted in the product, and audits can be deleted from the
            dashboard. Those actions remove items from the active workspace view, but they
            may not erase every historical record immediately where retention, integrity, or
            legal requirements apply.
          </p>
          <p>
            Broader account or data-deletion requests should be made through our contact
            email above. We will review those requests in light of applicable law and our
            operational, legal, and accounting obligations.
          </p>
        </Section>

        <Section title="17. Backlink and outreach information">
          <p>
            If you use the backlinks module, Norixo may store contact information, domain
            information, campaign data, outreach history, delivery events, inbound
            messages, verification history, notes, and activity records. This operational
            information can include personal or contact-related data, and it is processed to
            run the backlink workflow, track status, preserve history, and support delivery
            and verification behavior.
          </p>
          <p>
            User-agent information may be stored in the verification system as part of
            outbound HTTP verification options. This is used for controlled verification
            behavior rather than visitor tracking.
          </p>
        </Section>

        <Section title="18. Children’s privacy">
          <p>
            Norixo is intended for users aged 18 or older. We do not knowingly target
            children, and the service is not designed for minors.
          </p>
        </Section>

        <Section title="19. Changes to this Privacy Policy">
          <p>
            We may update this Privacy Policy from time to time to reflect changes in our
            service, our legal obligations, or our data practices. When changes are
            material, we will update the date at the top of the page and, where
            appropriate, provide additional notice.
          </p>
        </Section>

        <Section title="20. Contact us">
          <p>
            If you have a question, a request, or a privacy concern, contact Norixo at{" "}
            <a
              className="font-medium text-orange-300 underline-offset-4 hover:underline"
              href="mailto:support@norixo.io"
            >
              support@norixo.io
            </a>
            .
          </p>
          <p>
            Controller identity: {legalCopy.companyNameValue}, {legalCopy.legalFormValue}
            , {legalCopy.registeredOfficeValue.replace(/\n/g, ", ")}.
          </p>
        </Section>
      </div>

      <p className="mt-10">
        <Link
          href="/"
          className="text-sm font-medium text-slate-400 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
