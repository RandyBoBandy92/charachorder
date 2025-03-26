import { useState, useEffect, useCallback } from "react";
import "./ChordAnkiSystem.css";
import { mostUsedChords } from "../data/mostUsedChords";

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

// Local storage key
const STORAGE_KEY = "charachorder_anki_chord_system";

interface ChordCardState {
  word: string;
  chord: string[];
  rank: number;
  interval: number; // Current interval in minutes
  nextReviewTime: number; // Timestamp for next review (ms since epoch)
  lastReviewed: number; // Timestamp of last review (ms since epoch)
  ease: number; // Ease factor (like Anki, starting at 2.5)
  totalAttempts: number; // Total practice attempts
  correctAttempts: number; // Total correct attempts (for accuracy)
  state: CardStateType; // Card state in the learning cycle
  intervalLevel: number; // Current position in the interval progression
}

interface ChordAnkiSystemState {
  cards: ChordCardState[];
  activeCard: ChordCardState | null;
  userInput: string;
  sessionStats: {
    totalAttempts: number;
    correctAttempts: number;
    cardsReviewed: number;
  };
}

// Create a new card based on a chord
const createCard = (chordData: (typeof mostUsedChords)[0]): ChordCardState => {
  const now = Date.now();
  return {
    word: chordData.word,
    chord: chordData.chord,
    rank: chordData.rank,
    interval: INTERVALS.INITIAL,
    nextReviewTime: now, // Due immediately
    lastReviewed: 0, // Never reviewed
    ease: DEFAULT_EASE,
    totalAttempts: 0,
    correctAttempts: 0,
    state: "new",
    intervalLevel: 0,
  };
};

// Initialize the card deck
const createInitialState = (): ChordAnkiSystemState => {
  // Only use chords with actual chord data (some entries have empty chord arrays)
  const validChords = mostUsedChords.filter((chord) => chord.chord.length > 0);

  // Create cards for all chords
  const cards = validChords.map(createCard);

  // Sort initially by rank (highest first) for new cards
  cards.sort((a, b) => a.rank - b.rank);

  return {
    cards,
    activeCard: cards[0], // Start with highest ranked word
    userInput: "",
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

// Format chord letters for display
const formatChord = (chord: string[]): string => {
  return chord.map((letter) => letter.toUpperCase()).join(" + ");
};

export const ChordAnkiSystem = () => {
  const [state, setState] = useState<ChordAnkiSystemState>(() => {
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
  const [selectedCard, setSelectedCard] = useState<ChordCardState | null>(null);

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
  const handleResetCard = useCallback((word: string) => {
    if (
      window.confirm(
        `Are you sure you want to reset progress for the word "${word}"? This cannot be undone.`
      )
    ) {
      setState((prevState) => {
        // Find the chord in mostUsedChords
        const chordData = mostUsedChords.find((c) => c.word === word);
        if (!chordData) return prevState;

        // Create a new card
        const newCard = createCard(chordData);

        // Update the card in the list
        const updatedCards = prevState.cards.map((card) =>
          card.word === word ? newCard : card
        );

        return {
          ...prevState,
          cards: updatedCards,
          // If the active card was reset, update it too
          activeCard:
            prevState.activeCard?.word === word
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

        // Tiebreaker for cards with same due time: Rank (lower rank = more common)
        return a.rank - b.rank;
      });

      // Find the first due card
      const dueCards = sortedCards.filter((card) => card.nextReviewTime <= now);

      // If we have due cards, select the first one; otherwise use the next upcoming card
      const nextCard = dueCards.length > 0 ? dueCards[0] : sortedCards[0];

      return {
        ...prevState,
        activeCard: nextCard,
        userInput: "",
      };
    });
  }, []);

  // Handle rating selection - directly triggered from keyboard input
  const handleRating = useCallback((rating: 1 | 2 | 3 | 4) => {
    setState((prevState) => {
      if (!prevState.activeCard) return prevState;

      const now = Date.now();
      let updatedCard: ChordCardState;

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
          // For ratings 2, 3, 4 (since we're in the else block)
          const easeAdjustments = {
            2: -0.15, // Hard
            3: 0, // Good
            4: 0.15, // Easy
          };

          newEase += easeAdjustments[rating as 2 | 3 | 4];

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
        };
      }

      // Update the card in the list
      const updatedCards = prevState.cards.map((card) =>
        card.word === updatedCard.word ? updatedCard : card
      );

      // Update session stats
      const updatedSessionStats = {
        ...prevState.sessionStats,
        cardsReviewed: prevState.sessionStats.cardsReviewed + 1,
      };

      // Find the next card to show
      const sortedCards = [...updatedCards].sort((a, b) => {
        if (a.nextReviewTime !== b.nextReviewTime) {
          return a.nextReviewTime - b.nextReviewTime;
        }
        return a.rank - b.rank;
      });

      const currentTime = Date.now();
      const dueCards = sortedCards.filter(
        (card) => card.nextReviewTime <= currentTime
      );
      const nextCard = dueCards.length > 0 ? dueCards[0] : sortedCards[0];

      return {
        ...prevState,
        cards: updatedCards,
        activeCard: nextCard,
        userInput: "",
        sessionStats: updatedSessionStats,
      };
    });
  }, []);

  // Handle keyboard events globally
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only handle number keys 1-4 for rating
      if (e.key >= "1" && e.key <= "4" && activeTab === "practice") {
        e.preventDefault();
        const rating = parseInt(e.key) as 1 | 2 | 3 | 4;
        handleRating(rating);
      }
    },
    [handleRating, activeTab]
  );

  // Handle input change - just update the input value
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      setState((prevState) => ({
        ...prevState,
        userInput: input,
      }));
    },
    []
  );

  // Add keyboard event listener for global keypresses 1-4
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

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
    <div className="chord-anki-system">
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

          <div className="word-display">
            <div className="word">{state.activeCard.word}</div>
            <div className="chord-letters">
              Chord: {formatChord(state.activeCard.chord)}
            </div>
          </div>

          <div className="input-container">
            <div className="input-label">Practice area - type here:</div>
            <input
              type="text"
              className="chord-input"
              value={state.userInput}
              onChange={handleInputChange}
              autoFocus
            />
          </div>

          <div className="rating-instructions">
            When ready, press a number key to rate and continue:
          </div>

          <div className="rating-buttons">
            <div className="rating-button again">
              Again
              <span className="shortcut">1</span>
            </div>
            <div className="rating-button hard">
              Hard
              <span className="shortcut">2</span>
            </div>
            <div className="rating-button good">
              Good
              <span className="shortcut">3</span>
            </div>
            <div className="rating-button easy">
              Easy
              <span className="shortcut">4</span>
            </div>
          </div>

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
                <div className="stat-label">Mastered Chords</div>
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
                <th>Word</th>
                <th>Chord</th>
                <th>Next Review</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {[...state.cards]
                .sort((a, b) => a.nextReviewTime - b.nextReviewTime)
                .map((card) => (
                  <tr
                    key={card.word}
                    onClick={() =>
                      setSelectedCard(
                        selectedCard?.word === card.word ? null : card
                      )
                    }
                    className={
                      selectedCard?.word === card.word ? "selected" : ""
                    }
                  >
                    <td className="word-cell">{card.word}</td>
                    <td className="chord-cell">{formatChord(card.chord)}</td>
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
              <h3>Details for Word: {selectedCard.word}</h3>
              <div className="details-grid">
                <div>
                  <strong>Status:</strong> {selectedCard.state}
                </div>
                <div>
                  <strong>Chord:</strong> {formatChord(selectedCard.chord)}
                </div>
                <div>
                  <strong>Rank:</strong> {selectedCard.rank}
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
                  handleResetCard(selectedCard.word);
                }}
              >
                Reset Progress for this Word
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
