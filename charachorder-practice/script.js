import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get current file directory with ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to the files
const mostUsedWordsPath = path.join(
  __dirname,
  "src",
  "data",
  "mostUsedWords.tsx"
);
const chordsReadablePath = path.join(
  __dirname,
  "src",
  "data",
  "chordsReadable.tsx"
);
const outputPath = path.join(__dirname, "src", "data", "mostUsedChords.tsx");

// Function to extract data from mostUsedWords.tsx
function extractMostUsedWords(content) {
  // Extract the array portion from the file
  const arrayMatch = content.match(
    /export const mostUsedWords: WordFrequency\[\] = \[([\s\S]*?)\];/
  );
  if (!arrayMatch) {
    throw new Error("Could not extract mostUsedWords array");
  }

  const arrayContent = arrayMatch[1];

  // Parse the array items
  const wordEntries = arrayContent.match(
    /\{\s*word:\s*"([^"]+)",\s*rank:\s*(\d+)(?:,\s*frequency\?:\s*([^,\}]+))?\s*\}/g
  );

  if (!wordEntries) {
    throw new Error("Could not parse word entries");
  }

  return wordEntries.map((entry) => {
    const wordMatch = entry.match(/word:\s*"([^"]+)"/);
    const rankMatch = entry.match(/rank:\s*(\d+)/);

    return {
      word: wordMatch[1],
      rank: parseInt(rankMatch[1], 10),
    };
  });
}

// Function to extract data from chordsReadable.tsx
function extractChords(content) {
  // Extract the array portion from the file
  const arrayMatch = content.match(
    /export const chords: Chord\[\] = \[([\s\S]*?)\];/
  );
  if (!arrayMatch) {
    throw new Error("Could not extract chords array");
  }

  const arrayContent = arrayMatch[1];

  // Parse the array items
  const chordPattern =
    /{\s*chord:\s*\[((?:"[^"]+",?\s*)+)\],\s*word:\s*"([^"]+)",?\s*}/g;
  const chords = [];
  let match;

  while ((match = chordPattern.exec(arrayContent)) !== null) {
    const chordStrings = match[1]
      .match(/"([^"]+)"/g)
      .map((str) => str.replace(/"/g, ""));
    const word = match[2];

    chords.push({
      chord: chordStrings,
      word: word,
    });
  }

  return chords;
}

// Function to create the mostUsedChords.tsx file
function createMostUsedChordsFile(mostUsedWords, chords) {
  // Create a mapping of words to their chords
  const wordToChords = {};

  chords.forEach((chord) => {
    // Some words might have multiple chord combinations
    if (!wordToChords[chord.word]) {
      wordToChords[chord.word] = [];
    }
    wordToChords[chord.word].push(chord.chord);
  });

  // Match most used words with their chords
  const mostUsedChords = mostUsedWords.map((wordEntry) => {
    const matchingChords = wordToChords[wordEntry.word] || [];
    // If multiple chord combinations exist, take the first one
    const chord = matchingChords.length > 0 ? matchingChords[0] : [];

    return {
      word: wordEntry.word,
      rank: wordEntry.rank,
      chord: chord,
    };
  });

  // Generate TypeScript content
  const content = `interface MostUsedChord {
  word: string;
  rank: number;
  chord: string[];
}

export const mostUsedChords: MostUsedChord[] = [
${mostUsedChords
  .map(
    (entry) => `  {
    word: "${entry.word}",
    rank: ${entry.rank},
    chord: [${entry.chord.map((key) => `"${key}"`).join(", ")}]
  }`
  )
  .join(",\n")}
];
`;

  return content;
}

// Main function
async function main() {
  try {
    // Read the input files
    const mostUsedWordsContent = fs.readFileSync(mostUsedWordsPath, "utf8");
    const chordsReadableContent = fs.readFileSync(chordsReadablePath, "utf8");

    // Extract data
    const mostUsedWords = extractMostUsedWords(mostUsedWordsContent);
    const chords = extractChords(chordsReadableContent);

    // Create the output file content
    const outputContent = createMostUsedChordsFile(mostUsedWords, chords);

    // Write to the output file
    fs.writeFileSync(outputPath, outputContent, "utf8");

    console.log(`Successfully created ${outputPath}`);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main();
