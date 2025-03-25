import { useState, useEffect, useCallback } from "react";

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

interface LetterProgress {
  char: string;
  frequency: number;
  accuracy: number;
  attempts: number;
  lastAttempts: boolean[]; // Rolling window of recent attempts
  mastered: boolean;
  dateIntroduced: Date;
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
}

const STORAGE_KEY = "charachorder_dynamic_practice";
const INITIAL_LETTER_COUNT = 5;
const ATTEMPTS_WINDOW_SIZE = 20;

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
});

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
        })
      );
      parsedState.masteredLetters = parsedState.masteredLetters.map(
        (letter: LetterProgress) => ({
          ...letter,
          dateIntroduced: new Date(letter.dateIntroduced),
        })
      );
      parsedState.nextLettersToAdd = parsedState.nextLettersToAdd.map(
        (letter: LetterProgress) => ({
          ...letter,
          dateIntroduced: new Date(letter.dateIntroduced),
        })
      );
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
            return {
              ...letter,
              attempts: letter.attempts + 1,
              lastAttempts: newAttempts,
              accuracy:
                (letter.accuracy * letter.attempts + (isCorrect ? 1 : 0)) /
                (letter.attempts + 1),
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

        // Check if we should add new letters - do this check more frequently
        const lettersToAdd = checkProgression(updatedActive);
        let newActive = updatedActive;
        let newNext = prevState.nextLettersToAdd;

        if (lettersToAdd && prevState.nextLettersToAdd.length > 0) {
          const newLetters = prevState.nextLettersToAdd
            .slice(0, lettersToAdd)
            .map((letter) => ({
              ...letter,
              accuracy: 1,
              attempts: 0,
              lastAttempts: [],
              mastered: false,
              dateIntroduced: new Date(),
            }));
          newActive = [...updatedActive, ...newLetters];
          newNext = prevState.nextLettersToAdd.slice(lettersToAdd);
        }

        // Find the current letter's index and move to the next one
        const currentIndex = newActive.findIndex(
          (l) => l.char === prevState.currentChar
        );
        const nextIndex = (currentIndex + 1) % newActive.length;

        return {
          ...prevState,
          activeLetters: newActive,
          nextLettersToAdd: newNext,
          currentChar: newActive[nextIndex].char,
          lastKeyPressed: pressedKey,
          isCorrect,
          sessionAttempts: prevState.sessionAttempts + 1,
          sessionCorrect: prevState.sessionCorrect + 1,
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

  const accuracy =
    state.sessionAttempts > 0
      ? Math.round((state.sessionCorrect / state.sessionAttempts) * 100)
      : 0;

  return (
    <div className="dynamic-practice">
      <div className="progress-indicator">
        Active Letters: {state.activeLetters.length} / {ALL_LETTERS.length}
      </div>
      <div
        className={`character-display ${
          state.isCorrect === false ? "incorrect" : ""
        }`}
      >
        {state.currentChar}
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
            }`}
            title={`Accuracy: ${Math.round(letter.accuracy * 100)}%`}
          >
            {letter.char}
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
      <div className="stats">
        <div>Accuracy: {accuracy}%</div>
        <div>Session Attempts: {state.sessionAttempts}</div>
      </div>
      <div className="reset-section">
        <button className="reset-button" onClick={handleReset}>
          Reset Progress
        </button>
      </div>
    </div>
  );
};
