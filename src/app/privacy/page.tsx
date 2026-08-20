import type { Metadata } from "next";
import { LegalLayout, LegalHeading } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — Dance Teacher Expo 2027",
  description:
    "How Dance Teacher Expo collects, uses and protects your personal information.",
};

const CONTACT = "hello@danceteacherexpo.com.au";

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="Effective date: 10/10/2024">
      <p>
        Welcome to Dance Teacher Expo! We value your privacy and are committed to
        protecting your personal information. This privacy policy outlines our
        practices regarding the collection, use, and disclosure of your
        information through https://www.danceteacherexpo.com.au (the “Site”).
      </p>

      <LegalHeading>1. Information We Collect</LegalHeading>
      <p>
        We collect information that you provide directly to us when you register
        for the event, subscribe to our newsletters, or interact with us for any
        other purpose. This information may include your name, email address,
        postal address, phone number, and payment information.
      </p>

      <LegalHeading>2. How We Use Your Information</LegalHeading>
      <p>We use your information to:</p>
      <ul className="ml-5 grid list-disc gap-1.5">
        <li>
          Process transactions and send you related information, including
          confirmations and invoices.
        </li>
        <li>
          Send you technical notices, updates, security alerts, and support and
          administrative messages.
        </li>
        <li>
          Respond to your comments, questions, and requests, and provide customer
          service.
        </li>
        <li>
          Communicate with you about products, services, offers, promotions, and
          events offered by Dance Teacher Expo and others, and provide news and
          information we think will be of interest to you.
        </li>
      </ul>

      <LegalHeading>3. Sharing of Information</LegalHeading>
      <p>
        We may share your information with third-party vendors, consultants, and
        other service providers who need access to such information to carry out
        work on our behalf. We may also share your information in response to a
        request for information if we believe disclosure is in accordance with
        any applicable law, regulation, or legal process.
      </p>

      <LegalHeading>4. Security</LegalHeading>
      <p>
        We take reasonable measures to help protect information about you from
        loss, theft, misuse, and unauthorized access, disclosure, alteration, and
        destruction.
      </p>

      <LegalHeading>5. Your Choices</LegalHeading>
      <p>
        You may opt out of receiving promotional communications from Dance
        Teacher Expo by following the unsubscribe instructions in those
        communications. You can also contact us directly if you wish to be
        removed from our mailing list.
      </p>

      <LegalHeading>6. Changes to This Policy</LegalHeading>
      <p>
        We may change this privacy policy from time to time. If we make changes,
        we will notify you by revising the date at the top of the policy and, in
        some cases, we may provide you with additional notice (such as adding a
        statement to our homepage or sending you a notification).
      </p>

      <LegalHeading>7. Contact Us</LegalHeading>
      <p>
        If you have any questions about this privacy policy, please contact us
        at:{" "}
        <a
          href={`mailto:${CONTACT}`}
          className="font-bold text-pink hover:underline"
        >
          {CONTACT}
        </a>
        .
      </p>
    </LegalLayout>
  );
}
