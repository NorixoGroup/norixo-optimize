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

function Subsection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold tracking-tight text-white">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function TermsContent() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        Terms of Service
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Terms of Service
      </h1>
      <p className="mt-3 text-sm text-slate-400">Last updated: August 26, 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-7 text-slate-300">
        <p>
          These Terms of Service govern your access to and use of the Norixo website,
          software, and related services. By creating an account, using the free audit
          flow, running a paid audit, purchasing credits, managing a workspace, using the
          backlinks module, or otherwise accessing the service, you agree to these Terms
          and to the Privacy Policy available at{" "}
          <Link
            href="/privacy"
            className="font-medium text-orange-300 underline-offset-4 hover:underline"
          >
            /privacy
          </Link>
          .
        </p>

        <Section title="1. Who we are">
          <p>
            Norixo is operated by{" "}
            <strong className="text-white">{legalCopy.companyNameValue}</strong>, a{" "}
            {legalCopy.legalFormValue}. The verified registered office is{" "}
            {legalCopy.registeredOfficeValue.replace(/\n/g, ", ")}.
          </p>
          <p>
            Contact:{" "}
            <a
              className="font-medium text-orange-300 underline-offset-4 hover:underline"
              href="mailto:support@norixo.io"
            >
              support@norixo.io
            </a>
            .
          </p>
        </Section>

        <Section title="2. Scope of the service">
          <p>
            Norixo is primarily designed for hosts, property managers, conciergeries, and
            short-term-rental professionals or operators, while also remaining usable by
            individual hosts. Features may vary depending on the plan, account, market,
            platform, or service configuration.
          </p>
          <p>
            The service may include Free Audit, paid audits, listing optimization,
            AI-assisted titles and descriptions, recommendations, market analysis,
            benchmarks, pricing and revenue insights, workspace features, and
            backlink/outreach tooling where available under the applicable account or plan.
            Admin-only tooling and internal debug surfaces are not customer services and are
            not described here as if they were part of the public product offering.
          </p>
        </Section>

        <Section title="3. Accounts, workspaces, and access">
          <Subsection title="Account creation and sign-in">
            <p>
              Access to parts of the service requires an account. Account identity and
              authentication are handled through Supabase Auth. You must provide accurate
              information when creating or using your account and keep it up to date where
              reasonably possible.
            </p>
          </Subsection>
          <Subsection title="Workspace structure">
            <p>
              A single account may belong to more than one workspace. Workspaces may have
              owners and members with role-based access. Invitations may be used to add
              authorized users to a workspace.
            </p>
          </Subsection>
          <Subsection title="Credential security">
            <p>
              Your credentials are personal and must not be shared with unauthorized
              persons. Teams should use the workspace and invitation mechanisms provided by
              Norixo instead of sharing one login between multiple people.
            </p>
            <p>
              You are responsible for maintaining the confidentiality of your account and
              notifying us promptly if you suspect unauthorized access or misuse.
            </p>
          </Subsection>
          <Subsection title="Age">
            <p>Norixo is intended for users aged 18 years or older.</p>
          </Subsection>
        </Section>

        <Section title="4. Free Audit">
          <p>
            Free Audit is a free preview / analysis flow. It is rate-limited, based on
            available listing and market information, and intended to help you understand
            the potential of a listing before committing to a paid audit or other paid
            feature.
          </p>
          <p>
            Free Audit is indicative only. It is not a guarantee, not a substitute for a
            full paid audit, and not a promise of future performance. The result may be
            incomplete, estimated, or affected by the quality and availability of the input
            data.
          </p>
          <p>
            You are responsible for the accuracy of the URL or other information you submit.
            Norixo may limit repeated calls or apply abuse-prevention controls to protect the
            service.
          </p>
        </Section>

        <Section title="5. Paid audits, credits, and entitlements">
          <p>
            Some Norixo services require payment, credits, or another active entitlement.
            Depending on the applicable offer or account state, credits or entitlements may
            be consumed when eligible paid functionality is used.
          </p>
          <p>
            The exact quantity of included credits, the available features, and the current
            offer details are shown in the pricing, checkout, billing, or account interface
            that applies to your purchase or subscription. Displayed checkout pricing
            controls the purchase.
          </p>
          <p>
            Norixo does not promise indefinite credit validity, automatic recredit, or
            automatic restoration unless a specific product flow expressly states otherwise.
          </p>
        </Section>

        <Section title="6. Pricing">
          <p>
            Current prices, billing intervals, included credits, and feature inclusions are
            shown on the applicable pricing, checkout, or billing interface. Pricing may
            change over time, and the price shown at checkout controls the transaction for
            that purchase.
          </p>
          <p>
            Taxes may apply depending on your location and the applicable tax rules. If taxes
            are shown at checkout, they form part of the transaction amount.
          </p>
        </Section>

        <Section title="7. Stripe, subscriptions, and billing">
          <p>
            Norixo uses Stripe for payments, billing, checkout, subscriptions, and customer
            portal functionality. Stripe processes payment card data. Norixo may retain
            payment identifiers and status metadata needed to operate billing, but Norixo
            does not store full card numbers or card security codes in its application
            database.
          </p>
          <p>
            Some purchases may be one-time purchases, while others may be recurring
            subscriptions when clearly indicated at checkout. If a subscription is
            available, Stripe or the applicable billing interface may allow you to cancel
            future renewals according to the billing cycle. Cancellation of a subscription
            does not automatically create a refund for an already paid period.
          </p>
          <p>
            Billing-related records may include customer identifiers, subscription
            identifiers, checkout session identifiers, payment intent identifiers, invoice
            or payment status, amount, currency, and plan or entitlement information.
          </p>
        </Section>

        <Section title="8. Refunds">
          <p>
            Consumed audits or credits are generally not automatically refundable. Duplicate
            charges or verified billing errors may be corrected or refunded after review.
            Other refund requests may be reviewed case by case where appropriate. Mandatory
            statutory rights remain unaffected.
          </p>
          <p>
            Norixo does not offer a self-service refund system unless a specific checkout or
            support flow explicitly says otherwise.
          </p>
        </Section>

        <Section title="9. How the service works">
          <p>
            Norixo provides tools that analyze listings, prepare recommendations, support
            optimization work, and help users manage related workspace operations. The
            service may also surface pricing, revenue, occupancy, conversion, or benchmark
            insights derived from available data or model-based analysis.
          </p>
          <p>
            You remain responsible for how you apply the service outputs. Norixo provides
            tools and analysis; it does not make decisions for you.
          </p>
        </Section>

        <Section title="10. AI-assisted outputs">
          <p>
            Some outputs are generated or assisted by AI, including titles, descriptions,
            recommendations, audit analysis, and related content. AI-generated outputs may
            be incomplete, inaccurate, outdated, unsuitable, or non-unique.
          </p>
          <p>
            You must independently review AI-assisted outputs before publishing, applying,
            or relying on them. These outputs are advisory only and do not guarantee search
            position, Airbnb ranking, Booking ranking, bookings, occupancy, conversion,
            revenue, profitability, Superhost status, or platform approval.
          </p>
          <p>
            Norixo is not a substitute for legal, tax, financial, or professional
            property-management advice where expert judgment is required.
          </p>
          <p>
            Users may use outputs generated specifically for them for lawful personal or
            commercial purposes, subject to applicable law, third-party rights, and
            third-party platform rules. Similar or identical outputs may be generated for
            other users. Norixo retains its rights in the software, interface, brand,
            methodologies, templates, underlying systems, and original proprietary content.
          </p>
        </Section>

        <Section title="11. Market data, estimates, and financial disclaimers">
          <p>
            Market data, comparable information, pricing indications, occupancy estimates,
            conversion estimates, revenue projections, and similar outputs may be estimated,
            modeled, aggregated, inferred, or based on incomplete or changing information.
            Historical or modeled performance does not guarantee future results.
          </p>
          <p>
            Users remain solely responsible for their pricing, commercial, operational, and
            business decisions.
          </p>
        </Section>

        <Section title="12. Third-party platforms">
          <p>
            Norixo may reference or process data from platforms such as Airbnb, Booking.com,
            Expedia, Agoda, Vrbo, Abritel, and similar services. Unless expressly indicated
            otherwise, Norixo is independent, is not endorsed by or affiliated with these
            platforms, and their trademarks belong to their respective owners.
          </p>
          <p>
            Third-party sites and services may change or become unavailable. Norixo cannot
            guarantee continued compatibility, data availability, or the behavior of third-
            party platforms.
          </p>
        </Section>

        <Section title="13. User content and responsibilities">
          <p>
            You may submit URLs, listing descriptions, property information, images or image
            references, market and location information, and contact or outreach data where
            applicable. You must have the rights and authority necessary to submit and use
            that content.
          </p>
          <p>
            You are responsible for the legality, accuracy, permissions, and compliance of
            the content you submit, including compliance with third-party platform rules and
            any applicable privacy, electronic communications, or anti-spam laws.
          </p>
          <p>
            You grant Norixo a limited license necessary to host, process, analyze, display,
            transmit, and improve the service in connection with the content you submit. You
            do not transfer ownership of your content to Norixo.
          </p>
        </Section>

        <Section title="14. Backlink and outreach features">
          <p>
            If you use backlink or outreach features, you are responsible for ensuring that
            any contact or outreach data you submit is lawfully obtained and used and that
            your outreach complies with applicable privacy, electronic communications,
            anti-spam, and marketing laws.
          </p>
          <p>
            Norixo provides tooling only. It does not guarantee acceptance, publication,
            backlinks, ranking improvements, or responses. Norixo is not responsible for the
            legal compliance of your outreach content or strategy.
          </p>
        </Section>

        <Section title="15. Prohibited use">
          <p>You may not use Norixo to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>violate applicable law or regulation;</li>
            <li>commit fraud or other harmful activity;</li>
            <li>access accounts, systems, or data without authorization;</li>
            <li>misuse credentials or impersonate another person;</li>
            <li>bypass security controls or rate limits;</li>
            <li>interfere with or disrupt the service;</li>
            <li>perform abusive automated use or scraping that harms the service;</li>
            <li>infringe intellectual property or other rights; or</li>
            <li>use the service in a way that is unlawful, malicious, or materially harmful.</li>
          </ul>
        </Section>

        <Section title="16. Availability">
          <p>
            Norixo aims to provide a reliable service, but uninterrupted availability is
            not guaranteed. Maintenance, outages, errors, or third-party issues may affect
            access or performance. Service behavior may evolve over time as Norixo is
            improved or updated.
          </p>
        </Section>

        <Section title="17. Suspension and termination">
          <p>
            Norixo may restrict, suspend, or terminate access where reasonably necessary for
            material Terms violations, unlawful activity, security risk, fraud, abuse, or
            non-payment where applicable. Suspension or termination may also occur when
            necessary to protect the service or other users.
          </p>
          <p>
            You may stop using the service at any time and may cancel eligible recurring
            billing using the billing mechanisms provided where available.
          </p>
        </Section>

        <Section title="18. Privacy">
          <p>
            Our collection and use of personal data is described in our Privacy Policy at{" "}
            <Link
              href="/privacy"
              className="font-medium text-orange-300 underline-offset-4 hover:underline"
            >
              /privacy
            </Link>
            . This Terms of Service does not duplicate the Privacy Policy.
          </p>
        </Section>

        <Section title="19. Intellectual property">
          <p>
            Unless otherwise stated, Norixo owns the software, UI, brand, designs,
            documentation, methodologies, templates, original proprietary content, and other
            materials we create for the service.
          </p>
          <p>
            User content remains with the user or the relevant rights holder. Third-party
            trademarks remain the property of their respective owners. Any rights to use
            AI-generated outputs are limited by applicable law, third-party rights, and the
            platform terms applicable to the underlying data or content.
          </p>
        </Section>

        <Section title="20. Limitation of liability">
          <p>
            To the maximum extent permitted by law, Norixo is not liable for losses arising
            from inaccurate AI outputs, inaccurate estimates, third-party platform changes,
            implementation decisions made by users, service interruptions, provider
            failures, unauthorized account use where the user failed to protect credentials,
            or billing errors not caused by Norixo’s own breach.
          </p>
          <p>
            We do not exclude liability where it cannot be excluded under applicable law,
            including mandatory consumer protections that may apply.
          </p>
        </Section>

        <Section title="21. Governing law and disputes">
          <p>
            These Terms are governed by Moroccan law, without prejudice to any mandatory
            consumer protections that may apply under the law of your place of residence or
            other applicable law.
          </p>
          <p>
            Where permitted by law, disputes will be brought before the competent Moroccan
            courts. This clause does not limit any non-waivable rights that apply to you.
          </p>
        </Section>

        <Section title="22. Changes to these Terms">
          <p>
            We may update these Terms from time to time. The current version will be posted
            on Norixo, and material changes may be communicated through the website or
            service and, where appropriate or legally required, by another reasonable notice
            method. Continued use of the service after a change becomes effective may mean
            you accept the updated Terms, to the extent permitted by law.
          </p>
        </Section>

        <Section title="23. Contact">
          <p>
            If you have a question about these Terms, contact us at{" "}
            <a
              className="font-medium text-orange-300 underline-offset-4 hover:underline"
              href="mailto:support@norixo.io"
            >
              support@norixo.io
            </a>
            .
          </p>
          <p>
            Controller / publisher identity: {legalCopy.companyNameValue},{" "}
            {legalCopy.legalFormValue}, {legalCopy.registeredOfficeValue.replace(/\n/g, ", ")}
            .
          </p>
        </Section>
      </div>

      <p className="mt-10">
        <Link
          href="/"
          className="text-sm font-medium text-slate-400 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          Back to home
        </Link>
      </p>
    </div>
  );
}
