import { useState, useEffect, useCallback } from "react";
import "./AnkiMemorySystem.css";

// Use letter data from DynamicPractice
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

// Card states in the learning cycle
type CardStateType = "new" | "learning" | "review";

// Intervals in minutes - start small and grow
const INTERVALS = {
  INITIAL: 1,
  LEVEL_1: 5,
  LEVEL_2: 15,
  LEVEL_3: 30,
  LEVEL_4: 60, // 1 hour
  LEVEL_5: 120, // 2 hours
  LEVEL_6: 240, // 4 hours
  LEVEL_7: 480, // 8 hours
  LEVEL_8: 1440, // 24 hours (1 day)
  LEVEL_9: 2880, // 48 hours (2 days)
  LEVEL_10: 10080, // 1 week
};

// Fixed sequence for cards in learning phase
const LEARNING_INTERVALS = [
  INTERVALS.INITIAL,
  INTERVALS.LEVEL_1,
  INTERVALS.LEVEL_2,
  INTERVALS.LEVEL_3,
  INTERVALS.LEVEL_4,
];

// Default ease factor (similar to Anki)
const DEFAULT_EASE = 2.5;

// Required correct inputs before rating
const REQUIRED_CORRECT_INPUTS = 5;

// Local storage key
const STORAGE_KEY = "charachorder_anki_system";

interface CardState {
  char: string;
  frequency: number;
  interval: number; // Current interval in minutes
  nextReviewTime: number; // Timestamp for next review (ms since epoch)
  lastReviewed: number; // Timestamp of last review (ms since epoch)
  ease: number; // Ease factor (like Anki, starting at 2.5)
  correctCount: number; // Tracks correct inputs for this session (0-5)
  totalAttempts: number; // Total practice attempts
  correctAttempts: number; // Total correct attempts (for accuracy)
  state: CardStateType; // Card state in the learning cycle
  intervalLevel: number; // Current position in the interval progression
}

interface AnkiSystemState {
  cards: CardState[];
  activeCard: CardState | null;
  isCorrect: boolean | null;
  lastKeyPressed: string | null;
  currentStep: "input" | "rating"; // Whether we're typing or rating
  sessionStats: {
    totalAttempts: number;
    correctAttempts: number;
    cardsReviewed: number;
  };
}

// Create a new card based on a letter
const createCard = (letter: (typeof ALL_LETTERS)[0]): CardState => {
  const now = Date.now();
  return {
    char: letter.char,
    frequency: letter.frequency,
    interval: INTERVALS.INITIAL,
    nextReviewTime: now, // Due immediately
    lastReviewed: 0, // Never reviewed
    ease: DEFAULT_EASE,
    correctCount: 0,
    totalAttempts: 0,
    correctAttempts: 0,
    state: "new",
    intervalLevel: 0,
  };
};

// Initialize the card deck
const createInitialState = (): AnkiSystemState => {
  // Create cards for all letters
  const cards = ALL_LETTERS.map(createCard);

  // Sort initially by frequency (highest first) for new cards
  cards.sort((a, b) => b.frequency - a.frequency);

  return {
    cards,
    activeCard: cards[0], // Start with most frequent letter
    isCorrect: null,
    lastKeyPressed: null,
    currentStep: "input",
    sessionStats: {
      totalAttempts: 0,
      correctAttempts: 0,
      cardsReviewed: 0,
    },
  };
};

// Helper to format time for next review
const formatNextReviewTime = (timestamp: number): string => {
  const now = Date.now();
  const diffMs = timestamp - now;

  if (diffMs <= 0) {
    return "Due now";
  }

  const diffMinutes = Math.round(diffMs / (1000 * 60));

  if (diffMinutes < 60) {
    return `Due in ${diffMinutes} minute${diffMinutes === 1 ? "" : "s"}`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `Due in ${diffHours} hour${diffHours === 1 ? "" : "s"}`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
};

export const AnkiMemorySystem = () => {
  const [state, setState] = useState<AnkiSystemState>(() => {
    // Try to load state from localStorage
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        return JSON.parse(savedState);
      } catch (e) {
        console.error("Error parsing saved state:", e);
        return createInitialState();
      }
    }
    return createInitialState();
  });

  // Add activeTab state
  const [activeTab, setActiveTab] = useState<"practice" | "view-deck">(
    "practice"
  );
  // Add selectedCard state for the View Deck tab
  const [selectedCard, setSelectedCard] = useState<CardState | null>(null);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Reset to initial state (for debugging/testing)
  const handleReset = useCallback(() => {
    if (
      window.confirm(
        "Are you sure you want to reset your progress? This cannot be undone."
      )
    ) {
      setState(createInitialState());
    }
  }, []);

  // Reset progress for a single card
  const handleResetCard = useCallback((cardChar: string) => {
    if (
      window.confirm(
        `Are you sure you want to reset progress for the letter "${cardChar}"? This cannot be undone.`
      )
    ) {
      setState((prevState) => {
        // Find the letter in ALL_LETTERS
        const letterData = ALL_LETTERS.find((l) => l.char === cardChar);
        if (!letterData) return prevState;

        // Create a new card
        const newCard = createCard(letterData);

        // Update the card in the list
        const updatedCards = prevState.cards.map((card) =>
          card.char === cardChar ? newCard : card
        );

        return {
          ...prevState,
          cards: updatedCards,
          // If the active card was reset, update it too
          activeCard:
            prevState.activeCard?.char === cardChar
              ? newCard
              : prevState.activeCard,
        };
      });

      // Clear selection after reset
      setSelectedCard(null);
    }
  }, []);

  // Select the next due card
  const selectNextCard = useCallback(() => {
    setState((prevState) => {
      const now = Date.now();

      // Sort cards by due time (earliest first)
      const sortedCards = [...prevState.cards].sort((a, b) => {
        // First priority: Due time
        if (a.nextReviewTime !== b.nextReviewTime) {
          return a.nextReviewTime - b.nextReviewTime;
        }

        // Tiebreaker for cards with same due time: Frequency (higher first)
        return b.frequency - a.frequency;
      });

      // Find the first due card
      const dueCards = sortedCards.filter((card) => card.nextReviewTime <= now);

      // If we have due cards, select the first one; otherwise use the next upcoming card
      const nextCard = dueCards.length > 0 ? dueCards[0] : sortedCards[0];

      // Reset the card's correct count for this review session
      const updatedCard = {
        ...nextCard,
        correctCount: 0,
      };

      // Update the card in the list
      const updatedCards = prevState.cards.map((card) =>
        card.char === updatedCard.char ? updatedCard : card
      );

      return {
        ...prevState,
        cards: updatedCards,
        activeCard: updatedCard,
        isCorrect: null,
        lastKeyPressed: null,
        currentStep: "input",
      };
    });
  }, []);

  // Handle keyboard input during practice
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (!state.activeCard) return;

      // If we're in rating mode, handle number keys for ratings
      if (state.currentStep === "rating") {
        const keyNum = parseInt(event.key);
        if (keyNum >= 1 && keyNum <= 4) {
          event.preventDefault();
          handleRating(keyNum as 1 | 2 | 3 | 4);
        }
        return;
      }

      // We're in input mode, process the keypress
      event.preventDefault();
      const pressedKey = event.key.toUpperCase();
      const isCorrect = pressedKey === state.activeCard.char;

      setState((prevState) => {
        if (!prevState.activeCard) return prevState;

        // Update the active card
        const updatedCard = {
          ...prevState.activeCard,
          totalAttempts: prevState.activeCard.totalAttempts + 1,
          correctAttempts:
            prevState.activeCard.correctAttempts + (isCorrect ? 1 : 0),
          // Reset correctCount to 0 if incorrect, increment if correct
          correctCount: isCorrect ? prevState.activeCard.correctCount + 1 : 0,
        };

        // Update the card in the list
        const updatedCards = prevState.cards.map((card) =>
          card.char === updatedCard.char ? updatedCard : card
        );

        // Update session stats
        const updatedSessionStats = {
          ...prevState.sessionStats,
          totalAttempts: prevState.sessionStats.totalAttempts + 1,
          correctAttempts:
            prevState.sessionStats.correctAttempts + (isCorrect ? 1 : 0),
        };

        // Check if we've reached the required correct inputs for rating
        const shouldTransitionToRating =
          updatedCard.correctCount >= REQUIRED_CORRECT_INPUTS;

        return {
          ...prevState,
          cards: updatedCards,
          activeCard: updatedCard,
          isCorrect,
          lastKeyPressed: pressedKey,
          currentStep: shouldTransitionToRating ? "rating" : "input",
          sessionStats: updatedSessionStats,
        };
      });
    },
    [state.activeCard, state.currentStep]
  );

  // Handle rating selection
  const handleRating = useCallback(
    (rating: 1 | 2 | 3 | 4) => {
      setState((prevState) => {
        if (!prevState.activeCard) return prevState;

        const now = Date.now();
        let updatedCard: CardState;

        // Calculate new interval based on rating and card state
        if (rating === 1) {
          // Again - reset to initial interval
          updatedCard = {
            ...prevState.activeCard,
            interval: INTERVALS.INITIAL,
            nextReviewTime: now + INTERVALS.INITIAL * 60 * 1000,
            lastReviewed: now,
            state: "learning",
            intervalLevel: 0,
            correctCount: 0, // Reset counter for next practice session
          };
        } else {
          // For Hard, Good and Easy ratings
          let newInterval: number;
          let newIntervalLevel: number;
          let newState: CardStateType = prevState.activeCard.state;

          if (
            prevState.activeCard.state === "new" ||
            prevState.activeCard.state === "learning"
          ) {
            // In learning phase, progress through the fixed schedule
            newIntervalLevel = Math.min(
              prevState.activeCard.intervalLevel +
                (rating === 2 ? 1 : rating === 3 ? 1 : 2),
              LEARNING_INTERVALS.length - 1
            );

            // If we've reached the end of learning intervals, move to review
            if (newIntervalLevel >= LEARNING_INTERVALS.length - 1) {
              newState = "review";
            }

            newInterval = LEARNING_INTERVALS[newIntervalLevel];
          } else {
            // In review phase, use the multiplier system
            const intervalMultiplier =
              rating === 2
                ? 1.2 // Hard
                : rating === 3
                ? prevState.activeCard.ease // Good
                : prevState.activeCard.ease * 1.3; // Easy

            newInterval = Math.round(
              prevState.activeCard.interval * intervalMultiplier
            );

            // Cap at the maximum defined interval
            newInterval = Math.min(newInterval, INTERVALS.LEVEL_10);

            // Find the closest interval level
            const intervalLevels = Object.values(INTERVALS);
            newIntervalLevel = intervalLevels.findIndex(
              (level) => level >= newInterval
            );
            if (newIntervalLevel === -1)
              newIntervalLevel = intervalLevels.length - 1;
          }

          // Adjust ease factor based on rating (only in review phase)
          let newEase = prevState.activeCard.ease;
          if (prevState.activeCard.state === "review") {
            newEase +=
              rating === 1
                ? -0.2 // Again
                : rating === 2
                ? -0.15 // Hard
                : rating === 3
                ? 0 // Good
                : 0.15; // Easy

            // Ensure ease doesn't go below 1.3
            newEase = Math.max(1.3, newEase);
          }

          updatedCard = {
            ...prevState.activeCard,
            interval: newInterval,
            nextReviewTime: now + newInterval * 60 * 1000,
            lastReviewed: now,
            ease: newEase,
            state: newState,
            intervalLevel: newIntervalLevel,
            correctCount: 0, // Reset counter for next practice session
          };
        }

        // Update the card in the list
        const updatedCards = prevState.cards.map((card) =>
          card.char === updatedCard.char ? updatedCard : card
        );

        // Update session stats
        const updatedSessionStats = {
          ...prevState.sessionStats,
          cardsReviewed: prevState.sessionStats.cardsReviewed + 1,
        };

        return {
          ...prevState,
          cards: updatedCards,
          isCorrect: null,
          lastKeyPressed: null,
          currentStep: "input",
          sessionStats: updatedSessionStats,
        };
      });

      // After rating, select the next card
      selectNextCard();
    },
    [selectNextCard]
  );

  // Add keyboard event listener
  useEffect(() => {
    window.addEventListener("keypress", handleKeyPress);
    return () => {
      window.removeEventListener("keypress", handleKeyPress);
    };
  }, [handleKeyPress]);

  // Initialize by selecting the first card
  useEffect(() => {
    if (!state.activeCard) {
      selectNextCard();
    }
  }, [selectNextCard, state.activeCard]);

  // Calculate stats for display
  const stats = {
    dueCount: state.cards.filter((card) => card.nextReviewTime <= Date.now())
      .length,
    newCount: state.cards.filter((card) => card.state === "new").length,
    learningCount: state.cards.filter((card) => card.state === "learning")
      .length,
    reviewCount: state.cards.filter((card) => card.state === "review").length,
    accuracy:
      state.sessionStats.totalAttempts > 0
        ? Math.round(
            (state.sessionStats.correctAttempts /
              state.sessionStats.totalAttempts) *
              100
          )
        : 0,
  };

  return (
    <div className="anki-memory-system">
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === "practice" ? "active" : ""}`}
          onClick={() => setActiveTab("practice")}
        >
          Practice
        </button>
        <button
          className={`tab-button ${activeTab === "view-deck" ? "active" : ""}`}
          onClick={() => setActiveTab("view-deck")}
        >
          View Deck
        </button>
      </div>

      {activeTab === "practice" && state.activeCard && (
        <div className="practice-tab">
          <div className="progress-indicator">
            {formatNextReviewTime(state.activeCard.nextReviewTime)}
            <div>Card Status: {state.activeCard.state}</div>
          </div>

          <div
            className={`character-display ${
              state.isCorrect === false
                ? "incorrect"
                : state.isCorrect === true
                ? "correct"
                : ""
            }`}
          >
            {state.activeCard.char}
          </div>

          <div className="last-key-display">
            Last Key:
            <span
              className={
                state.isCorrect === false
                  ? "incorrect"
                  : state.isCorrect === true
                  ? "correct"
                  : ""
              }
            >
              {state.lastKeyPressed || "None"}
            </span>
          </div>

          <div className="correct-count">
            Correct inputs: {state.activeCard.correctCount}/
            {REQUIRED_CORRECT_INPUTS}
          </div>

          {state.currentStep === "rating" && (
            <div className="rating-buttons">
              <button
                className="rating-button again"
                onClick={() => handleRating(1 as 1 | 2 | 3 | 4)}
              >
                Again
                <span className="shortcut">1</span>
              </button>
              <button
                className="rating-button hard"
                onClick={() => handleRating(2 as 1 | 2 | 3 | 4)}
              >
                Hard
                <span className="shortcut">2</span>
              </button>
              <button
                className="rating-button good"
                onClick={() => handleRating(3 as 1 | 2 | 3 | 4)}
              >
                Good
                <span className="shortcut">3</span>
              </button>
              <button
                className="rating-button easy"
                onClick={() => handleRating(4 as 1 | 2 | 3 | 4)}
              >
                Easy
                <span className="shortcut">4</span>
              </button>
            </div>
          )}

          <div className="stats-display">
            <h3>Session Stats</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{stats.dueCount}</div>
                <div className="stat-label">Due Now</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{stats.accuracy}%</div>
                <div className="stat-label">Accuracy</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">
                  {state.sessionStats.cardsReviewed}
                </div>
                <div className="stat-label">Cards Reviewed</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{stats.reviewCount}</div>
                <div className="stat-label">Mastered Cards</div>
              </div>
            </div>
          </div>

          <button onClick={handleReset} style={{ marginTop: "2rem" }}>
            Reset All Progress
          </button>
        </div>
      )}

      {activeTab === "view-deck" && (
        <div className="view-deck-tab">
          <table className="deck-table">
            <thead>
              <tr>
                <th>Letter</th>
                <th>Next Review</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {[...state.cards]
                .sort((a, b) => a.nextReviewTime - b.nextReviewTime)
                .map((card) => (
                  <tr
                    key={card.char}
                    onClick={() =>
                      setSelectedCard(
                        selectedCard?.char === card.char ? null : card
                      )
                    }
                    className={
                      selectedCard?.char === card.char ? "selected" : ""
                    }
                  >
                    <td className="letter-cell">{card.char}</td>
                    <td>{formatNextReviewTime(card.nextReviewTime)}</td>
                    <td>
                      {card.totalAttempts > 0
                        ? Math.round(
                            (card.correctAttempts / card.totalAttempts) * 100
                          )
                        : 0}
                      %
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {selectedCard && (
            <div className="card-details">
              <h3>Details for Letter: {selectedCard.char}</h3>
              <div className="details-grid">
                <div>
                  <strong>Status:</strong> {selectedCard.state}
                </div>
                <div>
                  <strong>Frequency:</strong>{" "}
                  {selectedCard.frequency.toFixed(2)}%
                </div>
                <div>
                  <strong>Current Interval:</strong> {selectedCard.interval}{" "}
                  minutes
                </div>
                <div>
                  <strong>Next Review:</strong>{" "}
                  {formatNextReviewTime(selectedCard.nextReviewTime)}
                </div>
                <div>
                  <strong>Last Reviewed:</strong>{" "}
                  {selectedCard.lastReviewed
                    ? new Date(selectedCard.lastReviewed).toLocaleString()
                    : "Never"}
                </div>
                <div>
                  <strong>Ease Factor:</strong> {selectedCard.ease.toFixed(2)}
                </div>
                <div>
                  <strong>Total Attempts:</strong> {selectedCard.totalAttempts}
                </div>
                <div>
                  <strong>Correct Attempts:</strong>{" "}
                  {selectedCard.correctAttempts}
                </div>
                <div>
                  <strong>Accuracy:</strong>{" "}
                  {selectedCard.totalAttempts > 0
                    ? Math.round(
                        (selectedCard.correctAttempts /
                          selectedCard.totalAttempts) *
                          100
                      )
                    : 0}
                  %
                </div>
              </div>
              <button
                className="reset-card-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleResetCard(selectedCard.char);
                }}
              >
                Reset Progress for this Letter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
