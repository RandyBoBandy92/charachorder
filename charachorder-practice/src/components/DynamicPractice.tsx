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
}

const STORAGE_KEY = "charachorder_dynamic_practice";
const INITIAL_LETTER_COUNT = 5;
const ATTEMPTS_WINDOW_SIZE = 20;
const NEW_LETTER_ATTEMPTS_NEEDED = 5;
const REVIEW_LETTER_ATTEMPTS_NEEDED = 5;

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
});

// Fisher-Yates shuffle algorithm for randomizing array order
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
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
          visitedInCurrentStreak: letter.visitedInCurrentStreak || false,
        })
      );
      parsedState.masteredLetters = parsedState.masteredLetters.map(
        (letter: LetterProgress) => ({
          ...letter,
          dateIntroduced: new Date(letter.dateIntroduced),
          visitedInCurrentStreak: letter.visitedInCurrentStreak || false,
        })
      );
      parsedState.nextLettersToAdd = parsedState.nextLettersToAdd.map(
        (letter: LetterProgress) => ({
          ...letter,
          dateIntroduced: new Date(letter.dateIntroduced),
          visitedInCurrentStreak: letter.visitedInCurrentStreak || false,
        })
      );
      parsedState.streakProgress = parsedState.streakProgress || 0;
      return parsedState;
    }
    return createInitialState();
  });

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

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
    [state.sessionAttempts, state.sessionCorrect]
  );

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault();
      const pressedKey = event.key.toUpperCase();
      const isCorrect = pressedKey === state.currentChar;

      setState((prevState) => {
        // Update letter progress
        const updatedActive = prevState.activeLetters.map((letter) => {
          if (letter.char === prevState.currentChar) {
            const newAttempts = [...letter.lastAttempts, isCorrect].slice(
              -ATTEMPTS_WINDOW_SIZE
            );

            // Update successful attempts count if correct
            let newSuccessfulAttemptsCount = isCorrect
              ? letter.successfulAttemptsCount + 1
              : 0;

            // Check if letter needs review (3 or more mistakes in last 5 attempts)
            const recentAttempts = newAttempts.slice(-5);
            const recentMistakes = recentAttempts.filter(
              (attempt) => !attempt
            ).length;
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
            };
          }
          return letter;
        });

        // Only proceed if the input was correct
        if (!isCorrect) {
          return {
            ...prevState,
            activeLetters: updatedActive,
            lastKeyPressed: pressedKey,
            isCorrect,
            sessionAttempts: prevState.sessionAttempts + 1,
          };
        }

        // Find the current letter
        const currentLetter = updatedActive.find(
          (l) => l.char === prevState.currentChar
        );

        // Update streak progress by counting the visited letters
        let streakProgress = updatedActive.filter(
          (l) => l.visitedInCurrentStreak
        ).length;

        // Check if we've completed a full streak through all active letters
        const isStreakComplete = streakProgress === updatedActive.length;

        // Reset streak and randomize order if streak is complete
        let randomizedActive = updatedActive;
        if (isStreakComplete) {
          // Shuffle the array using Fisher-Yates algorithm
          randomizedActive = shuffleArray(updatedActive).map((letter) => ({
            ...letter,
            visitedInCurrentStreak: false, // Reset visited status for the new streak
          }));
          streakProgress = 0; // Reset streak progress
        }

        // If the letter is still in new or review mode and needs more successful attempts,
        // stay on it
        if (
          currentLetter &&
          (currentLetter.status === "new" ||
            currentLetter.status === "review") &&
          currentLetter.successfulAttemptsCount <
            currentLetter.successfulAttemptsNeeded
        ) {
          return {
            ...prevState,
            activeLetters: isStreakComplete ? randomizedActive : updatedActive,
            lastKeyPressed: pressedKey,
            isCorrect,
            sessionAttempts: prevState.sessionAttempts + 1,
            sessionCorrect: prevState.sessionCorrect + 1,
            streakProgress: streakProgress,
          };
        }

        // Check if we should add new letters
        const lettersToAdd = checkProgression(randomizedActive);
        let newActive = isStreakComplete ? randomizedActive : updatedActive;
        let newNext = prevState.nextLettersToAdd;

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
            }));
          newActive = [...newActive, ...newLetters];
          newNext = prevState.nextLettersToAdd.slice(lettersToAdd);
        }

        // Find next character to practice
        let nextChar;

        // First, look for any letters that need review
        const reviewLetter = newActive.find(
          (l) => l.status === "review" && !l.visitedInCurrentStreak
        );
        if (reviewLetter) {
          nextChar = reviewLetter.char;
        } else {
          // Then look for new letters
          const newLetter = newActive.find(
            (l) => l.status === "new" && !l.visitedInCurrentStreak
          );
          if (newLetter) {
            nextChar = newLetter.char;
          } else {
            // Then look for any unvisited normal letters
            const unvisitedLetter = newActive.find(
              (l) => !l.visitedInCurrentStreak
            );
            if (unvisitedLetter) {
              nextChar = unvisitedLetter.char;
            } else {
              // If all letters have been visited (shouldn't happen due to reset above)
              // just move to the next letter in sequence
              const currentIndex = newActive.findIndex(
                (l) => l.char === prevState.currentChar
              );
              const nextIndex = (currentIndex + 1) % newActive.length;
              nextChar = newActive[nextIndex].char;
            }
          }
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
            }`}
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
