import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY) {
  console.warn("Missing OPENAI_API_KEY. Set it in a .env file or environment.");
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));

export function buildLessonPrompt({ topic, level, category }) {
  return `
You are the teaching engine behind DNB COLLEGE, an AI Drum & Bass Ableton tutor for producers learning inside Ableton Live.

Generate one high-quality markdown lesson for:
- Topic: ${topic}
- Skill level: ${level}
- Category: ${category}

The lesson must feel like a premium, practical, save-worthy DnB tutorial made for replay later.

NON-NEGOTIABLE RULES
- Make it specifically about Drum & Bass production in Ableton Live
- Root all examples in authentic DnB / jungle / rollers / neuro / darker bass music workflows
- Give practical, real studio guidance, not generic filler
- Mention useful Ableton stock devices wherever relevant
- Include concrete settings, parameter ranges, routing, automation ideas, arrangement suggestions, and workflow choices where useful
- Match the requested skill level precisely
- Use an energetic, modern, professional teacher tone
- Use light emojis only where they add emphasis
- Do not mention plugins or features that do not exist
- Prefer stock Ableton workflows over third-party plugin advice

LESSON DEPTH
- Target roughly 2000-2400 words
- The walkthrough must contain 6-12 numbered steps
- Include at least 2 concrete parameter suggestions where relevant
- Include at least 1 musical or arrangement context example
- Include at least 1 "why this works in DnB" explanation

SECTION HEADINGS
Use exactly these headings and in this exact order:

# Lesson Overview
# What You Will Build
# Step-by-Step Walkthrough
# Common Mistakes
# Pro Tips for Darker / Heavier DnB
# Mini Practice Exercise
# Recap

SECTION REQUIREMENTS

# Lesson Overview
Explain the goal of the lesson, where it fits in a DnB track, and why the technique matters.

# What You Will Build
Describe the actual result in specific musical terms.

# Step-by-Step Walkthrough
- Use numbered steps
- Make each step actionable inside Ableton Live
- Include stock devices, settings, and workflow moves where relevant
- Adapt depth to ${level}
- Emphasize ${category} where relevant
- Keep examples tightly tied to ${topic}

# Common Mistakes
Include practical mistakes and direct fixes.

# Pro Tips for Darker / Heavier DnB
Include ideas that increase weight, tension, grit, movement, or underground character without ruining mix clarity.

# Mini Practice Exercise
Create a 10-20 minute exercise based directly on the lesson.

# Recap
Summarize only the most important takeaways.

CATEGORY EMPHASIS
- Basslines: sub weight, reese movement, note phrasing, saturation, stereo discipline, call-and-response
- Drums: break edits, layering, ghost notes, groove, transient control, bus shaping
- Arrangement: phrasing, drop design, switch-ups, DJ-friendly intros/outros, tension/release
- Mixing: headroom, low-end separation, mono checks, drum/bass balance, harshness control
- Sound Design: synthesis, resampling, modulation, texture, distortion, movement
- FX: transitions, atmospheres, fills, automation, impacts, risers/downlifters
- Workflow: templates, speed, decision-making, finishing, organization, references

SKILL LEVEL ADAPTATION
- Beginner: simplify terminology and keep the workflow approachable
- Intermediate: assume basic Ableton confidence and add stronger production judgment
- Advanced: include nuanced technical and creative detail without over-explaining basics

OUTPUT RULES
- Return markdown only
- No intro sentence before the lesson
- No code fences
- No meta commentary
`;
}

export function buildExpansionPrompt({ topic, level, category, lessonMarkdown }) {
  return `
You are an expert Ableton coach.
A user is viewing a generated tutorial.
Write an EXTRA companion section that ADDS MORE to the tutorial instead of repeating it.
Lesson topic: ${topic}
Level: ${level}
Category: ${category}
Existing tutorial:
${lessonMarkdown}
Return markdown with these sections:
1. Extra coach notes
2. Advanced variation ideas
3. Sound design extras
4. Arrangement upgrade ideas
5. Homework challenge
Keep it useful and practical.
Avoid repeating the same wording from the original tutorial.
`;
}

export function buildNarrationScript({ title, summary, lessonMarkdown, expansionMarkdown }) {
  return `
Create a spoken narration script for an audio lesson.
Title: ${title}
Summary: ${summary}
Use the lesson and the expansion material below.
The narration should:
- sound natural when spoken aloud
- explain the tutorial clearly
- add extra useful teacher-style commentary
- avoid markdown syntax like hashes or asterisks
- avoid reading bullet characters literally
- be engaging, slightly hyped, but still educational
Main lesson:
${lessonMarkdown}
Expansion:
${expansionMarkdown}
Write one clean narration script in plain text.
`;
}

app.post("/api/tutorial", async (req, res) => {
  try {
    const { topic, level, category } = req.body;
    if (!topic || !level || !category) {
      return res.status(400).json({ error: "topic, level, category are required" });
    }

    const lessonResponse = await client.responses.create({
      model: "gpt-4.1",
      input: buildLessonPrompt({ topic, level, category })
    });

    const lessonMarkdown = (lessonResponse.output_text || "").trim();

    const expansionResponse = await client.responses.create({
      model: "gpt-4.1",
      input: buildExpansionPrompt({ topic, level, category, lessonMarkdown })
    });

    const expansionMarkdown = (expansionResponse.output_text || "").trim();

    const imagePrompt = `Create a clean educational diagram for a Drum & Bass Ableton lesson.
Topic: ${topic}
Level: ${level}
Category: ${category}
Style: dark UI, cyan/purple accents, labeled blocks, arrows showing signal flow, readable text.
Include: Ableton stock devices and routing relevant to this lesson.`;

    const imageResponse = await client.images.generate({
      model: "gpt-image-1",
      prompt: imagePrompt,
      size: "1536x1024"
    });

    const imageBase64 = imageResponse.data?.[0]?.b64_json || "";

    const narrationResponse = await client.responses.create({
      model: "gpt-4.1",
      input: buildNarrationScript({
        title: `${topic} (${level})`,
        summary: `A ${category} tutorial for Drum & Bass production in Ableton Live.`,
        lessonMarkdown,
        expansionMarkdown
      })
    });

    const narrationScript = (narrationResponse.output_text || "").trim();

    return res.json({
      lessonMarkdown,
      expansionMarkdown,
      narrationScript,
      imageBase64
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error?.message || "Request failed"
    });
  }
});

app.listen(port, () => {
  console.log(`DNB College app running on http://localhost:${port}`);
});
