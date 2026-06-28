export type IndustryPage = {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  metadataTitle: string;
  metadataDescription: string;
  keywords: string[];
  audience: string;
  primaryCta: string;
  secondaryCta: string;
  heroImage: {
    src: string;
    alt: string;
  };
  growthProof: {
    label: string;
    headline: string;
    body: string;
    metrics: Array<{
      value: string;
      label: string;
    }>;
  };
  painPoints: string[];
  outcomes: Array<{
    title: string;
    description: string;
  }>;
  chatExample: {
    visitor: string;
    answer: string;
    capture: string;
    note: string;
  };
  workflow: Array<{
    title: string;
    description: string;
  }>;
  contentEngine: Array<{
    question: string;
    content: string;
    outcome: string;
  }>;
  proofPoints: string[];
  bookingPositioning: string;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
};

export const industryPages: IndustryPage[] = [
  {
    slug: "dentists",
    eyebrow: "Dental clinics",
    title: "Turn dental website visitors into booked, better-qualified patients.",
    description:
      "Convo answers patient questions, captures new-patient intent, routes ready visitors to booking, and turns repeated questions into useful dental content that can help the practice show up for more searches.",
    metadataTitle: "AI Chatbot for Dentists and Dental Clinics",
    metadataDescription:
      "Convo helps dental practices answer patient questions, capture enquiries, route visitors to booking, and create reviewed SEO content from repeated website questions.",
    keywords: [
      "AI chatbot for dentists",
      "dental chatbot",
      "dental practice lead capture",
      "dental website chat",
      "dental SEO content",
    ],
    audience:
      "For dental owners, practice managers, and marketing teams who want more patient enquiries without adding more repeated phone work.",
    primaryCta: "Start with your dental website",
    secondaryCta: "See the product",
    heroImage: {
      src: "https://images.unsplash.com/photo-1650803075918-efbee311735d?auto=format&fit=crop&w=1200&q=80",
      alt: "Smiling dental patient in a bright clinic",
    },
    growthProof: {
      label: "Patient acquisition",
      headline: "Capture intent before the patient chooses another clinic.",
      body:
        "Dental visitors often compare fees, urgency, payment options, and treatment fit before they book. Convo helps answer those questions, capture the enquiry, and show the practice which pages should exist next.",
      metrics: [
        { value: "24/7", label: "answers for after-hours visitors" },
        { value: "Lead", label: "captured with conversation context" },
        { value: "Content", label: "created from repeated patient questions" },
      ],
    },
    painPoints: [
      "Patients ask about fees, emergency slots, payment options, and treatment fit before they are ready to book.",
      "Reception loses time answering repeated website questions while also managing patients in the clinic.",
      "High-intent visitors often compare multiple practices after hours and leave if the next step is unclear.",
    ],
    outcomes: [
      {
        title: "Answer patient questions before booking",
        description:
          "Use approved practice pages and documents to explain services, opening hours, payment options, and what happens next.",
      },
      {
        title: "Send ready patients to the right action",
        description:
          "Keep Book now buttons, phone calls, and existing forms in place while Convo helps unsure visitors reach the next step.",
      },
      {
        title: "Capture better enquiries",
        description:
          "When follow-up makes sense, Convo can ask for contact details and summarise the patient's need for the team.",
      },
      {
        title: "Create content patients actually search for",
        description:
          "Repeated questions become reviewed FAQs, service page improvements, and article ideas that can support local search visibility.",
      },
    ],
    chatExample: {
      visitor:
        "I have tooth pain and I am not sure if I need an emergency appointment or just a check-up.",
      answer:
        "I can help with the booking options this practice offers. If you have severe pain, swelling, trauma, or bleeding, it is best to call the clinic directly or seek urgent care. For general tooth pain, I can show the next steps and help the team follow up.",
      capture:
        "Captured: tooth pain enquiry, preferred contact method, suburb, urgency note.",
      note:
        "Convo stays inside approved practice information and routes clinical concerns back to the clinic.",
    },
    workflow: [
      {
        title: "Ground answers in practice content",
        description:
          "Start from service pages, FAQs, fees pages, opening hours, payment information, and clinic policies.",
      },
      {
        title: "Guide each visitor to the right next step",
        description:
          "Ready patients can book. Unsure patients can ask first. Higher-risk questions can be directed to call the clinic.",
      },
      {
        title: "Turn repeated questions into reviewed content",
        description:
          "The questions patients keep asking become content recommendations for FAQs, service pages, and local dental guides.",
      },
    ],
    contentEngine: [
      {
        question: "How much does teeth whitening cost?",
        content: "Pricing explainer",
        outcome:
          "Helps price-aware patients understand options before they call or book.",
      },
      {
        question: "Do you offer emergency dental appointments today?",
        content: "Emergency appointment page",
        outcome:
          "Captures urgent intent and sends the visitor to the fastest approved contact path.",
      },
      {
        question: "What happens at a dental implant consultation?",
        content: "Implant consultation guide",
        outcome:
          "Builds trust for high-value treatment searches before the patient speaks to the clinic.",
      },
    ],
    proofPoints: [
      "Built for the questions patients ask before booking.",
      "Human review before publishing new content.",
      "Works with existing website pages, documents, forms, and booking calls to action.",
      "Designed to reduce repeated front-desk questions, not replace clinical judgement.",
    ],
    bookingPositioning:
      "Convo is not a replacement for your booking system. It helps more visitors reach the point where booking makes sense, then sends ready patients to your existing booking flow.",
    faqs: [
      {
        question: "Can Convo book dental appointments?",
        answer:
          "Convo can route patients to an existing booking page or capture details for follow-up. Where a supported booking provider is approved, booking can sit closer to the chat flow.",
      },
      {
        question: "Will Convo give dental advice?",
        answer:
          "No. Convo should answer approved business and service questions only. Clinical, urgent, or personal health questions should be routed to the dental team or urgent care guidance.",
      },
      {
        question: "Can it answer questions about pricing?",
        answer:
          "Yes, if the practice has approved pricing, payment, or fee guidance in the knowledge base. It can also explain when the team needs to confirm details first.",
      },
      {
        question: "Does it replace reception staff?",
        answer:
          "No. It helps handle repeated website questions, qualify intent, and give the team better context before they follow up.",
      },
    ],
  },
  {
    slug: "veterinary-clinics",
    eyebrow: "Veterinary clinics",
    title: "Help pet owners get answers, book the right next step, and find your clinic online.",
    description:
      "Convo answers routine pet owner questions, captures appointment intent, routes urgent concerns safely, and turns repeated clinic questions into reviewed content for search.",
    metadataTitle: "AI Chatbot for Veterinary Clinics",
    metadataDescription:
      "Convo helps veterinary clinics answer pet owner questions, capture enquiries, route visitors to booking or staff follow-up, and create reviewed SEO content.",
    keywords: [
      "AI chatbot for veterinary clinics",
      "veterinary chatbot",
      "vet clinic website chat",
      "vet appointment chatbot",
      "vet SEO content",
    ],
    audience:
      "For veterinary clinic owners, practice managers, and growth teams trying to reduce repeated admin while improving the pet owner experience.",
    primaryCta: "Start with your clinic website",
    secondaryCta: "See the product",
    heroImage: {
      src: "https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=1200&q=80",
      alt: "Pet owner and dog at a veterinary clinic",
    },
    growthProof: {
      label: "Clinic growth",
      headline: "More pet owners reach the right next step.",
      body:
        "Pet owners arrive with appointment questions, service questions, and worry. Convo helps the clinic respond quickly, capture follow-up details, and identify the content that could bring the next owner in from Google.",
      metrics: [
        { value: "24/7", label: "answers for routine clinic questions" },
        { value: "Route", label: "urgent concerns to approved pathways" },
        { value: "Content", label: "created from repeated owner questions" },
      ],
    },
    painPoints: [
      "Pet owners want quick answers about appointments, costs, opening hours, services, and next steps.",
      "Reception teams deal with repeated questions while urgent calls and in-clinic care compete for attention.",
      "After-hours visitors need safe guidance and a clear path without expecting the website to diagnose their pet.",
    ],
    outcomes: [
      {
        title: "Answer routine clinic questions",
        description:
          "Use approved clinic content to explain services, opening hours, appointment types, preparation instructions, and payment options.",
      },
      {
        title: "Route urgent questions safely",
        description:
          "Convo can direct emergency or clinical concerns to call the clinic, emergency vet, or approved after-hours pathway.",
      },
      {
        title: "Capture useful appointment context",
        description:
          "When follow-up is appropriate, Convo can collect owner details, pet type, concern, urgency, and preferred contact method.",
      },
      {
        title: "Create content pet owners are searching for",
        description:
          "Common questions become reviewed FAQs, service page updates, or care information approved by the clinic.",
      },
    ],
    chatExample: {
      visitor:
        "My dog has been vomiting today. Do I need to come in or can I wait until tomorrow?",
      answer:
        "I cannot assess your dog or give medical advice here. If symptoms are severe, repeated, or your pet seems weak or distressed, please call the clinic or an emergency vet now. I can share the clinic's appointment options and help the team follow up if this is not urgent.",
      capture:
        "Captured: dog vomiting enquiry, owner contact, preferred appointment timing, urgency note.",
      note:
        "Convo supports safe routing and clinic-approved information, not diagnosis.",
    },
    workflow: [
      {
        title: "Train from approved clinic content",
        description:
          "Use service pages, opening hours, fees guidance, policies, care instructions, and FAQs as the source of answers.",
      },
      {
        title: "Separate routine questions from urgent pathways",
        description:
          "Routine questions can be answered in chat. Urgent or clinical questions can be escalated to the clinic's approved instructions.",
      },
      {
        title: "Use repeated questions to improve the website",
        description:
          "The clinic can see which owner questions should become FAQs, care guides, appointment pages, or service page updates.",
      },
    ],
    contentEngine: [
      {
        question: "When should my puppy have vaccinations?",
        content: "Puppy vaccination guide",
        outcome:
          "Helps owners find clear, clinic-approved information before they book.",
      },
      {
        question: "Do you offer same-day appointments?",
        content: "Appointment availability FAQ",
        outcome:
          "Turns appointment intent into a booking path or a callback request.",
      },
      {
        question: "What should I do if my dog is vomiting?",
        content: "Safe call-now guidance",
        outcome:
          "Keeps medical decisions with the clinic while giving owners a clear next action.",
      },
    ],
    proofPoints: [
      "Built around the questions pet owners ask before calling or booking.",
      "Keeps veterinary care decisions with qualified staff.",
      "Works alongside existing appointment systems and contact forms.",
      "Helps clinics turn repeated questions into reviewed website content.",
    ],
    bookingPositioning:
      "Convo can sit before your appointment system, helping pet owners understand the next step before sending ready visitors to book or request a callback.",
    faqs: [
      {
        question: "Can Convo triage pets?",
        answer:
          "Convo should not diagnose or medically triage pets. It can identify when a question appears urgent and route the owner to the clinic's approved emergency or call-now guidance.",
      },
      {
        question: "Can it work with our existing appointment system?",
        answer:
          "Yes. Convo can send ready pet owners to your existing booking flow or capture details for staff follow-up.",
      },
      {
        question: "Can it answer questions about prices and services?",
        answer:
          "Yes, when that information is approved and available in the clinic knowledge base. It can also explain when the team needs to confirm details.",
      },
      {
        question: "Will it reduce phone pressure?",
        answer:
          "It can help reduce repeated website questions and give staff better context, while urgent or complex matters still go to the clinic.",
      },
    ],
  },
];

export function getIndustryPage(slug: string) {
  return industryPages.find((page) => page.slug === slug);
}
