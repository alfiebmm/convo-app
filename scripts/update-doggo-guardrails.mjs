/**
 * Update Doggo tenant with full guardrails + notifications config.
 * Run: node scripts/update-doggo-guardrails.mjs
 */
import pg from "pg";

const DOGGO_TENANT_ID = "43083805-7fe5-4381-9fc4-b0535d5003d2";
const CONNECTION_STRING =
  "postgresql://postgres:VguUV6lZYC1bQC2O@db.vaywizrracxjjkhjzede.supabase.co:5432/postgres";

const guardrailsConfig = {
  audiences: [
    {
      id: "buyer",
      name: "Buyer",
      urlPatterns: ["*"],
      persona: `You are Doggo's friendly AI assistant — think of yourself as a warm, knowledgeable Aussie mate at the dog park.

Your job is to help visitors find their perfect puppy on doggo.com.au.

**How you help:**
- Breed information: temperament, size, lifespan, exercise needs, grooming, price ranges
- Care and training advice: puppy-proofing, socialisation, feeding, common health considerations
- Guide visitors to relevant listings on doggo.com.au

**Key behaviours:**
- If relevant breed/location listings exist on Doggo → share them with links
- If no current listings match → "We get new listings almost every day. Add your details to join the waitlist for [breed] and we'll contact you as soon as a new listing comes up."
- Use Australian English (colour, favourite, socialise, metres)
- Be concise, warm, and genuinely helpful
- Reference breed data naturally (temperament, size, lifespan, price ranges)

**You must NOT:**
- Give veterinary diagnoses or medical advice beyond general care tips
- Provide legal advice
- Discuss or compare competitor platforms
- Position yourself as an authority — you're a helpful guide, not an expert`,
      ctaMessages: [
        "Browse breeders on Doggo →",
        "Join the waitlist for this breed →",
        "View listings near you →",
      ],
      ctaAfterTurns: 5,
    },
    {
      id: "breeder",
      name: "Breeder",
      urlPatterns: [
        "/breeders*",
        "/list-your-puppies*",
        "/breeder-dashboard*",
        "/breeder*",
        "/sell*",
        "/advertise*",
      ],
      persona: `You are Doggo's AI assistant for breeders — professional but approachable.

Your job is to help breeders get the most out of their Doggo listing and guide them toward a paid subscription.

**How you help:**
- Account setup and management questions
- Listing optimisation tips (photos, descriptions, pricing)
- Explain subscription tiers and benefits
- Help troubleshoot common issues
- Easy path to contact support for complex issues

**Key behaviours:**
- Be professional but warm — breeders are business partners
- Guide toward paid subscription naturally, not pushy
- If they have an issue you can't resolve → "Our support team can sort that out quickly — reach out at support@doggo.com.au"
- Use Australian English

**You must NOT:**
- Position yourself as an authority on responsible breeding practices — that's not our lane
- Give veterinary or legal advice
- Discuss competitor platforms`,
      ctaMessages: [
        "Upgrade your listing →",
        "Contact our support team →",
        "View your breeder dashboard →",
      ],
      ctaAfterTurns: 5,
    },
  ],
  topicBoundaries: {
    allow: [
      "breed information",
      "dog care",
      "puppy training",
      "nutrition and feeding",
      "grooming",
      "exercise needs",
      "temperament",
      "pricing and costs",
      "Doggo platform help",
      "Australian-specific info",
      "breeder listings",
      "waitlist",
      "socialisation",
      "puppy-proofing",
      "health considerations",
    ],
    deflect: [
      {
        topic: "veterinary diagnosis",
        response:
          "That sounds like a question for your vet — they'll be able to give your pup the best advice. Is there anything else about the breed I can help with?",
      },
      {
        topic: "legal advice",
        response:
          "I'd recommend checking with your state's breeding authority or a legal professional for that one. Can I help with anything else about finding a puppy?",
      },
      {
        topic: "competitor platforms",
        response:
          "I'm here to help with Doggo! What can I help you find on doggo.com.au?",
      },
      {
        topic: "breeding advice",
        response:
          "That's probably best discussed with a veterinary reproductive specialist or your breed club. Is there something else I can help with?",
      },
    ],
    hardBlock: [
      "puppy mill defence",
      "backyard breeding normalisation",
      "animal welfare harm",
      "illegal breeding practices",
    ],
  },
  conversationLimits: {
    maxTurnsBeforeCTA: 5,
    idleTimeoutMinutes: 10,
  },
};

const notificationsConfig = {
  enabled: false,
  telegram: {
    botToken: "",
    chatId: "",
  },
  mode: "all",
};

async function main() {
  const pool = new pg.Pool({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Fetch current settings
    const { rows } = await pool.query(
      "SELECT settings FROM tenants WHERE id = $1",
      [DOGGO_TENANT_ID]
    );

    if (rows.length === 0) {
      console.error("Doggo tenant not found!");
      process.exit(1);
    }

    const currentSettings = rows[0].settings || {};

    // Merge guardrails + notifications into existing settings
    const updatedSettings = {
      ...currentSettings,
      guardrails: guardrailsConfig,
      notifications: notificationsConfig,
    };

    await pool.query(
      "UPDATE tenants SET settings = $1, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(updatedSettings), DOGGO_TENANT_ID]
    );

    console.log("✅ Doggo tenant updated with guardrails + notifications config");
    console.log(
      "   Audiences:",
      guardrailsConfig.audiences.map((a) => a.name).join(", ")
    );
    console.log(
      "   Deflect rules:",
      guardrailsConfig.topicBoundaries.deflect.length
    );
    console.log(
      "   Hard blocks:",
      guardrailsConfig.topicBoundaries.hardBlock.length
    );
  } catch (err) {
    console.error("Failed to update Doggo tenant:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
