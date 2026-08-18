export const supportedSchemaTypes = [
  "Article",
  "NewsArticle",
  "BlogPosting",
  "QAPage",
  "HowTo",
  "FAQPage",
  "WebPage",
  "Organization",
  "Person",
  "ImageObject",
] as const;

export type SchemaType = (typeof supportedSchemaTypes)[number];

export type TypeCheck =
  | "string"
  | "nonEmptyString"
  | "isoDate"
  | "httpsUrl"
  | "image"
  | "personOrOrganization"
  | "thingOrUrl"
  | "question"
  | "answer"
  | "howToStep";

export type SchemaSpec = {
  required: string[];
  optional: string[];
  typeChecks: Record<string, TypeCheck>;
};

const articleTypeChecks: Record<string, TypeCheck> = {
  headline: "nonEmptyString",
  description: "string",
  image: "image",
  datePublished: "isoDate",
  dateModified: "isoDate",
  author: "personOrOrganization",
  "author.name": "nonEmptyString",
  publisher: "personOrOrganization",
  "publisher.name": "nonEmptyString",
  "publisher.logo": "image",
  "publisher.logo.url": "httpsUrl",
  mainEntityOfPage: "thingOrUrl",
  "mainEntityOfPage.@id": "httpsUrl",
  url: "httpsUrl",
};

export const jsonLdSchemaSpec: Record<SchemaType, SchemaSpec> = {
  Article: {
    required: ["headline", "image", "datePublished", "author.name"],
    optional: ["dateModified", "description", "publisher", "mainEntityOfPage", "url"],
    typeChecks: articleTypeChecks,
  },
  NewsArticle: {
    required: ["headline", "image", "datePublished", "author.name"],
    optional: ["dateModified", "description", "publisher", "mainEntityOfPage", "url"],
    typeChecks: articleTypeChecks,
  },
  BlogPosting: {
    required: ["headline", "image", "datePublished", "author.name"],
    optional: ["dateModified", "description", "publisher", "mainEntityOfPage", "url"],
    typeChecks: articleTypeChecks,
  },
  QAPage: {
    required: ["mainEntity.name", "mainEntity.acceptedAnswer.text"],
    optional: ["mainEntity.answerCount", "mainEntity.suggestedAnswer", "url"],
    typeChecks: {
      mainEntity: "question",
      "mainEntity.name": "nonEmptyString",
      "mainEntity.acceptedAnswer": "answer",
      "mainEntity.acceptedAnswer.text": "nonEmptyString",
      "mainEntity.suggestedAnswer": "answer",
      url: "httpsUrl",
    },
  },
  HowTo: {
    required: ["name", "step"],
    optional: ["description", "image", "totalTime", "supply", "tool"],
    typeChecks: {
      name: "nonEmptyString",
      description: "string",
      image: "image",
      step: "howToStep",
      supply: "thingOrUrl",
      tool: "thingOrUrl",
    },
  },
  FAQPage: {
    required: ["mainEntity.name", "mainEntity.acceptedAnswer.text"],
    optional: ["url"],
    typeChecks: {
      mainEntity: "question",
      "mainEntity.name": "nonEmptyString",
      "mainEntity.acceptedAnswer": "answer",
      "mainEntity.acceptedAnswer.text": "nonEmptyString",
      url: "httpsUrl",
    },
  },
  WebPage: {
    required: ["name", "url"],
    optional: ["description", "@id", "image", "author", "publisher"],
    typeChecks: {
      name: "nonEmptyString",
      url: "httpsUrl",
      "@id": "httpsUrl",
      description: "string",
      image: "image",
      author: "personOrOrganization",
      publisher: "personOrOrganization",
    },
  },
  Organization: {
    required: ["name", "url"],
    optional: ["logo", "description", "sameAs"],
    typeChecks: {
      name: "nonEmptyString",
      url: "httpsUrl",
      logo: "image",
      description: "string",
      sameAs: "httpsUrl",
    },
  },
  Person: {
    required: ["name", "url"],
    optional: ["image", "jobTitle", "sameAs"],
    typeChecks: {
      name: "nonEmptyString",
      url: "httpsUrl",
      image: "image",
      jobTitle: "string",
      sameAs: "httpsUrl",
    },
  },
  ImageObject: {
    required: ["url"],
    optional: ["contentUrl", "caption", "width", "height"],
    typeChecks: {
      url: "httpsUrl",
      contentUrl: "httpsUrl",
      caption: "string",
    },
  },
};
