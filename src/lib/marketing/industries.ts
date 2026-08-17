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
  compatibility?: {
    title: string;
    description: string;
    note: string;
    tools: Array<{
      name: string;
      category: string;
      logoDomain: string;
    }>;
  };
  supportHub?: {
    eyebrow: string;
    title: string;
    description: string;
    examples: Array<{
      source: string;
      question: string;
      answer: string;
    }>;
  };
  aiSearch?: {
    eyebrow: string;
    title: string;
    description: string;
    examples: string[];
  };
  roadmapChannels?: {
    title: string;
    description: string;
    channels: Array<{
      name: string;
      status: string;
      logoDomain: string;
    }>;
  };
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
    title:
      "Answer pet owner questions, capture bookings, and turn conversations into content.",
    description:
      "Convo answers from your clinic website and approved content, lets ready pet owners book without friction, and turns repeated questions into reviewed pages, FAQs, and guides for search.",
    metadataTitle: "AI Chatbot and Content Support for Veterinary Clinics",
    metadataDescription:
      "Convo helps veterinary clinics answer pet owner questions, support clients with approved resources, route visitors to booking or staff follow-up, and create reviewed SEO content.",
    keywords: [
      "AI chatbot for veterinary clinics",
      "veterinary chatbot",
      "vet clinic website chat",
      "vet appointment chatbot",
      "vet SEO content",
      "veterinary customer support chatbot",
    ],
    audience:
      "For veterinary clinic owners and practice managers who know content and client education matter, but cannot pull vets, nurses, or reception away from patients to write and explain everything from scratch.",
    primaryCta: "Start with your clinic website",
    secondaryCta: "See how it fits your workflow",
    heroImage: {
      src: "https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=1200&q=80",
      alt: "Pet owner and dog at a veterinary clinic",
    },
    growthProof: {
      label: "Clinic support and growth",
      headline: "Use the questions your team already answers.",
      body:
        "Pet owners arrive with appointment questions, care questions, policy questions, and worry. Convo helps the clinic respond from approved information, capture follow-up context, and identify the content that could bring the next pet owner in from Google and AI search.",
      metrics: [
        { value: "24/7", label: "answers from approved clinic resources" },
        { value: "Capture", label: "pet, owner, urgency, and contact context" },
        { value: "Review", label: "draft content before anything goes live" },
      ],
    },
    painPoints: [
      "Your team answers the same pet owner questions about appointments, costs, vaccines, desexing, after-hours care, preparation, and policies every week.",
      "Clinics already have useful service pages, policies, care information, and booking details, but pet owners still call because the answer is hard to find or too generic.",
      "Pet owners are asking longer questions in Google and AI tools. If your clinic does not have clear, helpful answers, another source may become the answer.",
    ],
    outcomes: [
      {
        title: "Answer from your website and clinic content",
        description:
          "Use existing service pages, policies, opening hours, pricing guidance, FAQs, and approved clinic information to answer pet owner questions in plain language.",
      },
      {
        title: "Let ready pet owners book immediately",
        description:
          "If a pet owner is ready to book, the widget gives them a direct booking entry point without forcing them through a chat or qualification flow.",
      },
      {
        title: "Use chat when pet owners need clarity",
        description:
          "If they have questions first, Convo answers them and then suggests the right booking, callback, phone, or call-now path inside the same experience.",
      },
      {
        title: "Create content without starting from blank pages",
        description:
          "Repeated questions become draft FAQs, service page updates, support articles, and care guides the clinic can review before publishing.",
      },
    ],
    chatExample: {
      visitor:
        "My dog has been vomiting today. Do I need to come in or can I wait until tomorrow?",
      answer:
        "I cannot assess your dog or give medical advice here. If symptoms are severe, repeated, or your pet seems weak or distressed, please call the clinic or an emergency vet now. I can also show the clinic's booking options if this is not urgent.",
      capture:
        "Answered from clinic-approved guidance. Next step: call now, book online, or ask a follow-up question.",
      note:
        "Convo explains approved clinic resources and routes clinical concerns back to the team.",
    },
    workflow: [
      {
        title: "Start with the website and approved clinic content",
        description:
          "Sync service pages, FAQs, fees guidance, policies, care information, and booking details so answers come from what the clinic trusts.",
      },
      {
        title: "Keep booking and chat in one widget",
        description:
          "Ready pet owners can book straight away. Pet owners with questions can ask first, then book through the same packaged experience.",
      },
      {
        title: "Turn repeated questions into reviewed content",
        description:
          "The clinic can see which questions should become FAQs, care guides, appointment pages, social topics, or service page updates.",
      },
    ],
    contentEngine: [
      {
        question: "When should my puppy have vaccinations?",
        content: "Puppy vaccination schedule guide",
        outcome:
          "Helps new puppy families understand timing and book the right appointment.",
      },
      {
        question: "How much does desexing cost and what is included?",
        content: "Desexing pricing and preparation explainer",
        outcome:
          "Answers a common commercial question while letting the clinic control caveats and follow-up.",
      },
      {
        question: "What should I do after my cat's procedure?",
        content: "Post-procedure support article",
        outcome:
          "Turns existing discharge material into a clearer support experience for pet owners.",
      },
    ],
    proofPoints: [
      "Answers from approved clinic information, not open-ended guesswork.",
      "Keeps veterinary care decisions with qualified staff.",
      "Works alongside existing booking systems, PMS workflows, websites, and forms.",
      "Gives staff a support tool they can refer clients to before handling follow-up questions.",
    ],
    bookingPositioning:
      "Convo packages chat and booking together. Ready pet owners can go straight to the clinic's booking path, while unsure pet owners can ask questions first and then book without leaving the widget experience.",
    compatibility: {
      title: "Designed to fit the clinic stack you already have.",
      description:
        "Show pet owners the right answer, then route them into the booking, contact, website, or practice workflow your team already uses.",
      note:
        "Example tools and channels common in veterinary workflows. Connection method depends on the clinic setup and should not imply a certified partnership unless confirmed.",
      tools: [
        { name: "Vetstoria", category: "Online booking", logoDomain: "vetstoria.com" },
        { name: "ezyVet", category: "Practice management", logoDomain: "ezyvet.com" },
        { name: "Provet Cloud", category: "Practice management", logoDomain: "provet.com" },
        { name: "IDEXX", category: "Diagnostics workflow", logoDomain: "idexx.com.au" },
        { name: "Xero", category: "Business systems", logoDomain: "xero.com" },
        { name: "Google Business Profile", category: "Local discovery", logoDomain: "google.com" },
        { name: "WordPress", category: "Clinic website", logoDomain: "wordpress.org" },
        { name: "Webflow", category: "Clinic website", logoDomain: "webflow.com" },
      ],
    },
    supportHub: {
      eyebrow: "Client support",
      title: "Help pet owners find the right answer before they call.",
      description:
        "The support angle is simple: Convo can answer from the clinic's website and approved information, so pet owners can ask in their own words instead of hunting through pages or calling reception for routine questions.",
      examples: [
        {
          source: "Clinic website",
          question: "Do you offer same-day appointments?",
          answer:
            "Explains appointment options from the clinic's approved information and points ready pet owners to booking.",
        },
        {
          source: "Vaccination information",
          question: "Can my puppy go to the park yet?",
          answer:
            "Uses the clinic's vaccination guidance to explain timing, exposure risk, and when to book the next appointment.",
        },
        {
          source: "Clinic policy",
          question: "What happens if I miss my appointment?",
          answer:
            "Answers from the clinic's approved cancellation, deposit, and rescheduling policy instead of sending the pet owner back to reception.",
        },
      ],
    },
    aiSearch: {
      eyebrow: "AI search",
      title: "AI answers need clear clinic-owned content to work from.",
      description:
        "Pet owners are no longer only searching short phrases like 'vet near me'. They are asking full questions in Google AI results, ChatGPT, Gemini, and other assistants. Convo helps clinics build the clear, reviewed answer library those searches need, using questions pet owners are already asking.",
      examples: [
        "Does my puppy need another vaccination before puppy school?",
        "What should I do if my dog is vomiting?",
        "How much does desexing cost and what is included?",
        "When should I call an emergency vet?",
      ],
    },
    roadmapChannels: {
      title: "More channels from the same conversations.",
      description:
        "Website content comes first because it supports search, AI answers, and conversion. Over time, the same question data can help create Instagram posts, YouTube explainers, and other clinic education content.",
      channels: [
        { name: "Instagram", status: "Roadmap", logoDomain: "instagram.com" },
        { name: "YouTube", status: "Roadmap", logoDomain: "youtube.com" },
      ],
    },
    faqs: [
      {
        question: "Can Convo triage pets?",
        answer:
          "Convo should not diagnose or medically triage pets. It can identify when a question appears urgent and route the pet owner to the clinic's approved emergency or call-now guidance.",
      },
      {
        question: "Does it replace Vetstoria, ezyVet, Provet, or our booking system?",
        answer:
          "No. Convo can sit before your existing booking or follow-up path. It helps pet owners understand the right next step, then sends them to the approved workflow.",
      },
      {
        question: "Can staff refer clients to the chat for support questions?",
        answer:
          "Yes. If the clinic has approved website content, service information, policies, and care guidance, Convo can help pet owners ask follow-up questions in their own words. Clinical or urgent concerns should still route back to the clinic.",
      },
      {
        question: "Will our team need to write the content?",
        answer:
          "Not from scratch. Convo uses repeated pet owner questions as the raw material for draft FAQs, guides, and service-page improvements. The clinic can review before anything is published.",
      },
      {
        question: "Can this help with AI search?",
        answer:
          "It can support it. AI search experiences tend to rely on clear, structured, useful answers. Convo helps clinics create that content from real pet owner questions, without promising guaranteed rankings or AI citations.",
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
