import { useState, useEffect, useCallback } from "react";
import { StatsDashboard } from "./StatsDashboard";
import "./DynamicPractice.css";

// All letters with frequency data
const ALL_LETTERS = [
  { char: "E", frequency: 11.1607 },
  { char: "A", frequency: 8.4966 },
  { char: "R", frequency: 7.5809 },
  { char: "I", frequency: 7.5448 },
  { char: "O", frequency: 7.1635 },
  { char: "T", frequency: 6.9509 },
  { char: "N", frequency: 6.6544 },
  { char: "S", frequency: 5.7351 },
  { char: "L", frequency: 5.4893 },
  { char: "C", frequency: 4.5388 },
  { char: "U", frequency: 3.6308 },
  { char: "D", frequency: 3.3844 },
  { char: "P", frequency: 3.1671 },
  { char: "M", frequency: 3.0129 },
  { char: "H", frequency: 3.0034 },
  { char: "G", frequency: 2.4705 },
  { char: "B", frequency: 2.072 },
  { char: "F", frequency: 1.8121 },
  { char: "Y", frequency: 1.7779 },
  { char: "W", frequency: 1.2899 },
  { char: "K", frequency: 1.1016 },
  { char: "V", frequency: 1.0074 },
  { char: "X", frequency: 0.2902 },
  { char: "Z", frequency: 0.2722 },
  { char: "J", frequency: 0.1965 },
  { char: "Q", frequency: 0.1962 },
];

// Status types for tracking letter progress
export type LetterStatus = "new" | "review" | "normal";

export interface LetterProgress {
  char: string;
  frequency: number;
  accuracy: number;
  attempts: number;
  lastAttempts: boolean[];
  mastered: boolean;
  dateIntroduced: Date;
  status: LetterStatus;
  successfulAttemptsNeeded: number;
  successfulAttemptsCount: number;
  visitedInCurrentStreak: boolean;

  // New properties for enhanced selection algorithm
  familiarityScore: number;
  lastPracticed: Date;
  selectionWeight: number;
  errorPatterns: {
    consecutiveErrors: number;
    confusedWith: { [char: string]: number };
  };
}

interface PracticeState {
  activeLetters: LetterProgress[];
  masteredLetters: LetterProgress[];
  nextLettersToAdd: LetterProgress[];
  currentChar: string;
  lastKeyPressed: string | null;
  isCorrect: boolean | null;
  sessionAttempts: number;
  sessionCorrect: number;
  streakProgress: number;
  lastLetterAddedAttempt: number; // Track when we last added a letter
  sessionQueue: string[]; // Queue of characters to practice in current session
}

const STORAGE_KEY = "charachorder_dynamic_practice";
const INITIAL_LETTER_COUNT = 5;
const ATTEMPTS_WINDOW_SIZE = 20;
const NEW_LETTER_ATTEMPTS_NEEDED = 5;
const REVIEW_LETTER_ATTEMPTS_NEEDED = 5;
const MIN_ATTEMPTS_BEFORE_ADDING_LETTERS = 25; // Minimum attempts before adding more letters

// Helper function to calculate days between two dates
const daysBetween = (date1: Date, date2: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
  const diffDays = Math.round(
    Math.abs((date1.getTime() - date2.getTime()) / oneDay)
  );
  return diffDays;
};

// Calculate selection weight for a letter
const calculateSelectionWeight = (letter: LetterProgress): number => {
  // Base weight from letter frequency in language
  let weight = letter.frequency / 10;

  // Adjust for accuracy (lower accuracy = higher weight)
  weight *= 2 - letter.accuracy;

  // Boost new letters
  if (letter.attempts < 10) {
    weight *= 2;
  }

  return weight;
};

const createInitialState = (): PracticeState => {
  const initialActive = ALL_LETTERS.slice(0, INITIAL_LETTER_COUNT).map(
    createLetterProgress
  );
  const remainingLetters =
    ALL_LETTERS.slice(INITIAL_LETTER_COUNT).map(createLetterProgress);

  return {
    activeLetters: initialActive,
    masteredLetters: [],
    nextLettersToAdd: remainingLetters,
    currentChar: initialActive[0].char,
    lastKeyPressed: null,
    isCorrect: null,
    sessionAttempts: 0,
    sessionCorrect: 0,
    streakProgress: 0,
    lastLetterAddedAttempt: 0,
    sessionQueue: [],
  };
};

const createLetterProgress = (
  letter: (typeof ALL_LETTERS)[0]
): LetterProgress => ({
  ...letter,
  accuracy: 1,
  attempts: 0,
  lastAttempts: [],
  mastered: false,
  dateIntroduced: new Date(),
  status: "new",
  successfulAttemptsNeeded: NEW_LETTER_ATTEMPTS_NEEDED,
  successfulAttemptsCount: 0,
  visitedInCurrentStreak: false,
  // New properties
  familiarityScore: 0,
  lastPracticed: new Date(),
  selectionWeight: (letter.frequency / 10) * 2, // Initial weight based on frequency with new letter boost
  errorPatterns: {
    consecutiveErrors: 0,
    confusedWith: {},
  },
});

// Enhanced letter selection logic
const selectNextChar = (
  letters: LetterProgress[],
  lastChar: string | null = null
): string => {
  // Don't select the same letter twice in a row if possible
  const availableLetters = lastChar
    ? letters.filter((l) => l.char !== lastChar)
    : letters;

  if (availableLetters.length === 0) return letters[0].char;

  // Calculate weights for each letter
  const weightedLetters = availableLetters.map((letter) => {
    // Base selection probability
    let weight = letter.selectionWeight;

    // 1. Progressive Introduction Weighting
    const daysSinceIntroduction = daysBetween(
      new Date(),
      letter.dateIntroduced
    );
    if (daysSinceIntroduction < 7) {
      weight *= 5 - daysSinceIntroduction * 0.5; // 5x down to 1.5x over a week
    }

    // 2. Familiarity-Based Scheduling
    weight *= 1 / (letter.familiarityScore + 0.1); // Inverse relationship

    // 4. Error-Sensitive Boost
    if (letter.errorPatterns.consecutiveErrors > 0) {
      weight *= 1 + letter.errorPatterns.consecutiveErrors * 0.5; // Boost by 50% per consecutive error
    }

    // 5. Time-Decay for new vs old letters
    const recencyFactor =
      letter.attempts < 10
        ? 0.99 // Slower decay for new letters
        : 0.95; // Faster decay for familiar letters

    const millisecondsSinceLastPracticed =
      new Date().getTime() - letter.lastPracticed.getTime();
    const hoursSinceLastPracticed =
      millisecondsSinceLastPracticed / (1000 * 60 * 60);

    // Boost priority for letters not practiced recently
    weight *= Math.pow(recencyFactor, -hoursSinceLastPracticed);

    return {
      char: letter.char,
      weight,
    };
  });

  // Normalize weights
  const totalWeight = weightedLetters.reduce(
    (sum, letter) => sum + letter.weight,
    0
  );
  const normalizedLetters = weightedLetters.map((letter) => ({
    char: letter.char,
    probability: letter.weight / totalWeight,
  }));

  // Select based on weighted probability
  const random = Math.random();
  let cumulativeProbability = 0;

  for (const letter of normalizedLetters) {
    cumulativeProbability += letter.probability;
    if (random <= cumulativeProbability) {
      return letter.char;
    }
  }

  // Fallback
  return normalizedLetters[0].char;
};

// Create interleaved practice session
const createPracticeSession = (activeLetters: LetterProgress[]): string[] => {
  // Categorize letters
  const newLetters = activeLetters.filter((l) => l.attempts < 10);
  const familiarLetters = activeLetters.filter((l) => l.attempts >= 10);

  // Create interleaved pattern (3. Interleaving Pattern)
  const sessionQueue: string[] = [];

  // If we have new letters, create interleaved sequence
  if (newLetters.length > 0) {
    let lastChar: string | null = null;

    // Start with a new letter
    const firstChar = selectNextChar(newLetters);
    sessionQueue.push(firstChar);
    lastChar = firstChar;

    // Basic pattern: New → Familiar → Familiar → New → Familiar
    for (let i = 0; i < 5; i++) {
      // Add familiar letters
      for (let j = 0; j < 2; j++) {
        if (familiarLetters.length > 0) {
          const nextChar = selectNextChar(familiarLetters, lastChar);
          sessionQueue.push(nextChar);
          lastChar = nextChar;
        }
      }

      // Add a new letter
      if (newLetters.length > 0) {
        const nextChar = selectNextChar(newLetters, lastChar);
        sessionQueue.push(nextChar);
        lastChar = nextChar;
      }

      // Add one more familiar
      if (familiarLetters.length > 0) {
        const nextChar = selectNextChar(familiarLetters, lastChar);
        sessionQueue.push(nextChar);
        lastChar = nextChar;
      }
    }
  } else {
    // If no new letters, select based on weighted algorithm
    let lastChar: string | null = null;
    for (let i = 0; i < 20; i++) {
      const nextChar = selectNextChar(activeLetters, lastChar);
      sessionQueue.push(nextChar);
      lastChar = nextChar;
    }
  }

  return sessionQueue;
};

// Update letter progress with the new metrics
const updateLetterProgress = (
  letter: LetterProgress,
  isCorrect: boolean,
  pressedKey: string
): LetterProgress => {
  // Update attempts and accuracy as before
  const newAttempts = [...letter.lastAttempts, isCorrect].slice(
    -ATTEMPTS_WINDOW_SIZE
  );

  // Update consecutive errors
  const consecutiveErrors = isCorrect
    ? 0
    : letter.errorPatterns.consecutiveErrors + 1;

  // Update familiarity score - exponentially increasing score that represents mastery
  const familiarityIncrement = isCorrect ? 0.1 : -0.05;
  const newFamiliarityScore = Math.max(
    0,
    letter.familiarityScore + familiarityIncrement
  );

  // If incorrect, track which letter was confused with this one
  const confusedWith = { ...letter.errorPatterns.confusedWith };
  if (!isCorrect) {
    confusedWith[pressedKey] = (confusedWith[pressedKey] || 0) + 1;
  }

  // Update successful attempts count if correct
  let newSuccessfulAttemptsCount = isCorrect
    ? letter.successfulAttemptsCount + 1
    : 0;

  // Check if letter needs review (3 or more mistakes in last 5 attempts)
  const recentAttempts = newAttempts.slice(-5);
  const recentMistakes = recentAttempts.filter((attempt) => !attempt).length;
  const needsReview = recentMistakes >= 3;

  // Determine the letter's status
  let newStatus: LetterStatus = letter.status;
  let newAttemptsNeeded = letter.successfulAttemptsNeeded;

  // If the letter needs review, reset the count and set to review mode
  if (needsReview && letter.status !== "review") {
    newStatus = "review";
    newAttemptsNeeded = REVIEW_LETTER_ATTEMPTS_NEEDED;
    newSuccessfulAttemptsCount = 0;
  }

  // If we've completed the required attempts, move to normal mode
  if (
    newSuccessfulAttemptsCount >= newAttemptsNeeded &&
    (letter.status === "new" || letter.status === "review")
  ) {
    newStatus = "normal";
    newAttemptsNeeded = 0;
  }

  // Mark letter as visited if the input was correct
  const newVisitedInCurrentStreak = isCorrect
    ? true
    : letter.visitedInCurrentStreak;

  return {
    ...letter,
    attempts: letter.attempts + 1,
    lastAttempts: newAttempts,
    accuracy:
      (letter.accuracy * letter.attempts + (isCorrect ? 1 : 0)) /
      (letter.attempts + 1),
    status: newStatus,
    successfulAttemptsNeeded: newAttemptsNeeded,
    successfulAttemptsCount: newSuccessfulAttemptsCount,
    visitedInCurrentStreak: newVisitedInCurrentStreak,
    lastPracticed: new Date(),
    familiarityScore: newFamiliarityScore,
    errorPatterns: {
      consecutiveErrors,
      confusedWith,
    },
    // Recalculate selection weight
    selectionWeight: calculateSelectionWeight(letter),
  };
};

export const DynamicPractice = () => {
  const [state, setState] = useState<PracticeState>(() => {
    // Try to load state from localStorage
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      const parsedState = JSON.parse(savedState);
      // Convert stored date strings back to Date objects
      parsedState.activeLetters = parsedState.activeLetters.map(
        (letter: LetterProgress) => ({
          ...letter,
          dateIntroduced: new Date(letter.dateIntroduced),
          lastPracticed: new Date(
            letter.lastPracticed || letter.dateIntroduced
          ),
          visitedInCurrentStreak: letter.visitedInCurrentStreak || false,
          // Initialize new properties if they don't exist in saved state
          familiarityScore: letter.familiarityScore || 0,
          selectionWeight:
            letter.selectionWeight || calculateSelectionWeight(letter),
          errorPatterns: letter.errorPatterns || {
            consecutiveErrors: 0,
            confusedWith: {},
          },
        })
      );
      parsedState.masteredLetters = parsedState.masteredLetters.map(
        (letter: LetterProgress) => ({
          ...letter,
          dateIntroduced: new Date(letter.dateIntroduced),
          lastPracticed: new Date(
            letter.lastPracticed || letter.dateIntroduced
          ),
          visitedInCurrentStreak: letter.visitedInCurrentStreak || false,
          // Initialize new properties if they don't exist in saved state
          familiarityScore: letter.familiarityScore || 0,
          selectionWeight:
            letter.selectionWeight || calculateSelectionWeight(letter),
          errorPatterns: letter.errorPatterns || {
            consecutiveErrors: 0,
            confusedWith: {},
          },
        })
      );
      parsedState.nextLettersToAdd = parsedState.nextLettersToAdd.map(
        (letter: LetterProgress) => ({
          ...letter,
          dateIntroduced: new Date(letter.dateIntroduced),
          lastPracticed: new Date(
            letter.lastPracticed || letter.dateIntroduced
          ),
          visitedInCurrentStreak: letter.visitedInCurrentStreak || false,
          // Initialize new properties if they don't exist in saved state
          familiarityScore: letter.familiarityScore || 0,
          selectionWeight:
            letter.selectionWeight || calculateSelectionWeight(letter),
          errorPatterns: letter.errorPatterns || {
            consecutiveErrors: 0,
            confusedWith: {},
          },
        })
      );
      parsedState.streakProgress = parsedState.streakProgress || 0;
      parsedState.sessionQueue = parsedState.sessionQueue || [];
      return parsedState;
    }
    return createInitialState();
  });

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Generate new session queue if needed
  useEffect(() => {
    if (state.sessionQueue.length === 0) {
      setState((prevState) => ({
        ...prevState,
        sessionQueue: createPracticeSession(prevState.activeLetters),
        currentChar:
          prevState.currentChar || selectNextChar(prevState.activeLetters),
      }));
    }
  }, [state.sessionQueue]);

  const handleReset = useCallback(() => {
    if (
      window.confirm(
        "Are you sure you want to reset your progress? This cannot be undone."
      )
    ) {
      setState(createInitialState());
    }
  }, []);

  const checkProgression = useCallback(
    (letterProgress: LetterProgress[]) => {
      // Check progression more frequently - every 10 attempts
      if (state.sessionAttempts % 10 !== 0) return null;

      // Check if we've had enough attempts since last adding letters
      if (
        state.sessionAttempts - state.lastLetterAddedAttempt <
        MIN_ATTEMPTS_BEFORE_ADDING_LETTERS
      ) {
        return null;
      }

      // Calculate overall accuracy for active letters
      const overallAccuracy = state.sessionCorrect / state.sessionAttempts;

      // Make it easier to progress - lower threshold
      if (overallAccuracy < 0.8) return null;

      // Check recent performance
      const recentMistakes = letterProgress.reduce((count, letter) => {
        const recentAttempts = letter.lastAttempts.slice(-5); // Look at last 5 attempts
        return count + recentAttempts.filter((attempt) => !attempt).length;
      }, 0);

      // Make progression more generous
      if (recentMistakes === 0) return 2; // Perfect performance: add 2 letters
      if (recentMistakes <= 2) return 1; // Good performance: add 1 letter
      return 0; // Need more practice
    },
    [state.sessionAttempts, state.sessionCorrect, state.lastLetterAddedAttempt]
  );

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault();
      const pressedKey = event.key.toUpperCase();
      const isCorrect = pressedKey === state.currentChar;

      setState((prevState) => {
        // Find the current letter
        const currentLetterIndex = prevState.activeLetters.findIndex(
          (l) => l.char === prevState.currentChar
        );

        if (currentLetterIndex === -1) return prevState;

        // Update letter progress with new algorithm
        const updatedLetter = updateLetterProgress(
          prevState.activeLetters[currentLetterIndex],
          isCorrect,
          pressedKey
        );

        // Create updated active letters array
        const updatedActive = [
          ...prevState.activeLetters.slice(0, currentLetterIndex),
          updatedLetter,
          ...prevState.activeLetters.slice(currentLetterIndex + 1),
        ];

        // If incorrect, just update the state and stay on the same letter
        if (!isCorrect) {
          return {
            ...prevState,
            activeLetters: updatedActive,
            lastKeyPressed: pressedKey,
            isCorrect,
            sessionAttempts: prevState.sessionAttempts + 1,
          };
        }

        // Update streak progress
        let streakProgress = updatedActive.filter(
          (l) => l.visitedInCurrentStreak
        ).length;

        // Check if we've completed a full streak
        const isStreakComplete = streakProgress === updatedActive.length;

        // Reset streak and generate new session if streak is complete
        let newSessionQueue = [...prevState.sessionQueue];
        if (isStreakComplete) {
          // Reset visited status for the new streak
          const resetLetters = updatedActive.map((letter) => ({
            ...letter,
            visitedInCurrentStreak: false,
          }));

          // Generate new session queue
          newSessionQueue = createPracticeSession(resetLetters);
          streakProgress = 0;
        }

        // Check if we should add new letters
        const lettersToAdd = checkProgression(updatedActive);
        let newActive = isStreakComplete
          ? updatedActive.map((l) => ({ ...l, visitedInCurrentStreak: false }))
          : updatedActive;
        let newNext = prevState.nextLettersToAdd;
        let newLastLetterAddedAttempt = prevState.lastLetterAddedAttempt;

        if (lettersToAdd && prevState.nextLettersToAdd.length > 0) {
          const newLetters = prevState.nextLettersToAdd
            .slice(0, lettersToAdd)
            .map((letter) => ({
              ...letter,
              accuracy: 1,
              attempts: 0,
              lastAttempts: [] as boolean[],
              mastered: false,
              dateIntroduced: new Date(),
              status: "new" as LetterStatus,
              successfulAttemptsNeeded: NEW_LETTER_ATTEMPTS_NEEDED,
              successfulAttemptsCount: 0,
              visitedInCurrentStreak: false,
              familiarityScore: 0,
              lastPracticed: new Date(),
              selectionWeight: calculateSelectionWeight(letter),
              errorPatterns: {
                consecutiveErrors: 0,
                confusedWith: {},
              },
            }));
          newActive = [...newActive, ...newLetters];
          newNext = prevState.nextLettersToAdd.slice(lettersToAdd);
          newLastLetterAddedAttempt = prevState.sessionAttempts;

          // Generate new session queue if adding new letters
          newSessionQueue = createPracticeSession(newActive);
        }

        // Get next character from queue or generate if empty
        let nextChar: string;
        if (newSessionQueue.length > 0) {
          nextChar = newSessionQueue[0];
          newSessionQueue = newSessionQueue.slice(1);
        } else {
          nextChar = selectNextChar(newActive, prevState.currentChar);
        }

        return {
          ...prevState,
          activeLetters: newActive,
          nextLettersToAdd: newNext,
          currentChar: nextChar,
          lastKeyPressed: pressedKey,
          isCorrect,
          sessionAttempts: prevState.sessionAttempts + 1,
          sessionCorrect: prevState.sessionCorrect + 1,
          streakProgress: streakProgress,
          lastLetterAddedAttempt: newLastLetterAddedAttempt,
          sessionQueue: newSessionQueue,
        };
      });
    },
    [state.currentChar, checkProgression]
  );

  useEffect(() => {
    window.addEventListener("keypress", handleKeyPress);
    return () => {
      window.removeEventListener("keypress", handleKeyPress);
    };
  }, [handleKeyPress]);

  // Helper function to determine the status label text
  const getProgressText = (letter: LetterProgress) => {
    if (letter.status === "new") return "New Letter";
    if (letter.status === "review") return "Review Letter";
    return "";
  };

  // Get the current letter details
  const currentLetter = state.activeLetters.find(
    (l) => l.char === state.currentChar
  );

  return (
    <div className="dynamic-practice">
      <div className="progress-indicator">
        Active Letters: {state.activeLetters.length} / {ALL_LETTERS.length}
        <div className="streak-info">
          Streak: {state.streakProgress} / {state.activeLetters.length}
        </div>
      </div>
      <div
        className={`character-display ${
          state.isCorrect === false ? "incorrect" : ""
        }`}
      >
        {state.currentChar}
        {currentLetter &&
          (currentLetter.status === "new" ||
            currentLetter.status === "review") && (
            <div className={`letter-progress ${currentLetter.status}`}>
              <div className="progress-text">
                {getProgressText(currentLetter)}:{" "}
                {currentLetter.successfulAttemptsCount} /{" "}
                {currentLetter.successfulAttemptsNeeded}
              </div>
              <div className="progress-dots">
                {[...Array(currentLetter.successfulAttemptsNeeded)].map(
                  (_, i) => (
                    <span
                      key={i}
                      className={`progress-dot ${
                        i < currentLetter.successfulAttemptsCount
                          ? "completed"
                          : ""
                      }`}
                    />
                  )
                )}
              </div>
            </div>
          )}
      </div>
      <div className="last-key-display">
        Last Key:{" "}
        <span
          className={
            state.isCorrect === false
              ? "incorrect"
              : state.isCorrect
              ? "correct"
              : ""
          }
        >
          {state.lastKeyPressed || "None"}
        </span>
      </div>
      <div className="active-letters">
        {state.activeLetters.map((letter) => (
          <span
            key={letter.char}
            className={`letter-indicator ${
              letter.char === state.currentChar ? "current" : ""
            } ${letter.status}`}
            title={`Accuracy: ${Math.round(letter.accuracy * 100)}%${
              letter.status !== "normal"
                ? ` | ${getProgressText(letter)}: ${
                    letter.successfulAttemptsCount
                  }/${letter.successfulAttemptsNeeded}`
                : ""
            } | Familiarity: ${letter.familiarityScore.toFixed(1)}`}
          >
            {letter.char}
            {(letter.status === "new" || letter.status === "review") && (
              <span className={`status-badge ${letter.status}`}>
                {letter.successfulAttemptsCount}
              </span>
            )}
          </span>
        ))}
      </div>
      <div className="next-letters">
        Next up:{" "}
        {state.nextLettersToAdd
          .slice(0, 3)
          .map((l) => l.char)
          .join(", ")}
      </div>
      <StatsDashboard
        activeLetters={state.activeLetters}
        sessionAttempts={state.sessionAttempts}
        sessionCorrect={state.sessionCorrect}
      />
      <div className="reset-section">
        <button className="reset-button" onClick={handleReset}>
          Reset Progress
        </button>
      </div>
    </div>
  );
};
