import { useState, useEffect, useCallback } from "react";

// Frequency data from Concise Oxford Dictionary analysis
const FREQUENT_CHARS = [
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
];

const REQUIRED_CONSECUTIVE = 5;

interface PracticeState {
  currentCharIndex: number;
  currentChar: string;
  isCorrect: boolean | null;
  totalAttempts: number;
  correctAttempts: number;
  consecutiveCorrect: number;
  bestStreak: number;
  lastKeyPressed: string | null;
}

export const CharacterPractice = () => {
  const [state, setState] = useState<PracticeState>({
    currentCharIndex: 0,
    currentChar: FREQUENT_CHARS[0].char,
    isCorrect: null,
    totalAttempts: 0,
    correctAttempts: 0,
    consecutiveCorrect: 0,
    bestStreak: 0,
    lastKeyPressed: null,
  });

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault();
      const pressedKey = event.key.toUpperCase();
      const isCorrect = pressedKey === state.currentChar;

      setState((prevState) => {
        const newConsecutiveCorrect = isCorrect
          ? prevState.consecutiveCorrect + 1
          : 0;
        const shouldAdvance = newConsecutiveCorrect >= REQUIRED_CONSECUTIVE;

        // If incorrect, reset to beginning
        if (!isCorrect) {
          return {
            ...prevState,
            isCorrect,
            lastKeyPressed: pressedKey,
            totalAttempts: prevState.totalAttempts + 1,
            currentCharIndex: 0,
            currentChar: FREQUENT_CHARS[0].char,
            consecutiveCorrect: 0,
            bestStreak: Math.max(
              prevState.bestStreak,
              prevState.currentCharIndex
            ),
          };
        }

        // If correct and should advance
        if (shouldAdvance) {
          const nextIndex = prevState.currentCharIndex + 1;
          const reachedEnd = nextIndex >= FREQUENT_CHARS.length;

          if (reachedEnd) {
            return {
              ...prevState,
              isCorrect,
              lastKeyPressed: pressedKey,
              totalAttempts: prevState.totalAttempts + 1,
              correctAttempts: prevState.correctAttempts + 1,
              consecutiveCorrect: 0,
              currentCharIndex: 0,
              currentChar: FREQUENT_CHARS[0].char,
              bestStreak: FREQUENT_CHARS.length,
            };
          }

          return {
            ...prevState,
            isCorrect,
            lastKeyPressed: pressedKey,
            totalAttempts: prevState.totalAttempts + 1,
            correctAttempts: prevState.correctAttempts + 1,
            consecutiveCorrect: 0,
            currentCharIndex: nextIndex,
            currentChar: FREQUENT_CHARS[nextIndex].char,
            bestStreak: Math.max(prevState.bestStreak, nextIndex),
          };
        }

        // Correct but not enough consecutive hits yet
        return {
          ...prevState,
          isCorrect,
          lastKeyPressed: pressedKey,
          totalAttempts: prevState.totalAttempts + 1,
          correctAttempts: prevState.correctAttempts + 1,
          consecutiveCorrect: newConsecutiveCorrect,
        };
      });
    },
    [state.currentChar]
  );

  useEffect(() => {
    window.addEventListener("keypress", handleKeyPress);
    return () => {
      window.removeEventListener("keypress", handleKeyPress);
    };
  }, [handleKeyPress]);

  const accuracy =
    state.totalAttempts > 0
      ? Math.round((state.correctAttempts / state.totalAttempts) * 100)
      : 0;

  return (
    <div className="character-practice">
      <div className="progress-indicator">
        Best Streak: {state.bestStreak} / {FREQUENT_CHARS.length}
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
      <div className="consecutive-indicator">
        Consecutive: {state.consecutiveCorrect}/{REQUIRED_CONSECUTIVE}
      </div>
      <div className="sequence-display">
        {FREQUENT_CHARS.map((char, index) => (
          <span
            key={char.char}
            className={`sequence-char ${
              index === state.currentCharIndex ? "current" : ""
            } ${index < state.currentCharIndex ? "completed" : ""}`}
          >
            {char.char}
          </span>
        ))}
      </div>
      <div className="instructions">
        Get each character {REQUIRED_CONSECUTIVE} times correctly to advance.
        <br />
        Any mistake sends you back to 'E'!
      </div>
      <div className="stats">Accuracy: {accuracy}%</div>
    </div>
  );
};
