import React, { useState, useEffect, useRef } from "react";
import "./PracticeTabs.css"; // Reusing existing styles

// Type for history entry
interface HistoryEntry {
  text: string;
  date: string;
}

// Type for word list entry
interface WordListEntry {
  Word: string;
  Frequency: number;
  "Main Type": string;
}

export const CustomPractice = () => {
  const [inputText, setInputText] = useState("");
  const [units, setUnits] = useState<string[]>([]);
  const [currentUnitIndex, setCurrentUnitIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showWordListModal, setShowWordListModal] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [isShuffled, setIsShuffled] = useState(false);
  const [isInterleaved, setIsInterleaved] = useState(false);
  const [isRepeated, setIsRepeated] = useState(false);
  const [requireTrailingSpace, setRequireTrailingSpace] = useState(false);
  const [interleaveCount, setInterleaveCount] = useState(3); // Default: 3 repetitions
  const [interleaveInputValue, setInterleaveInputValue] = useState("3"); // Input field value
  const [practiceActive, setPracticeActive] = useState(false);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [showCycleNotification, setShowCycleNotification] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [masterMode, setMasterMode] = useState(false);
  const [wordList, setWordList] = useState<WordListEntry[]>([]);
  const [wordListLoading, setWordListLoading] = useState(false);
  const [wordListError, setWordListError] = useState<string | null>(null);
  const [selectedWordCount, setSelectedWordCount] = useState(100);
  const [wordCountInputValue, setWordCountInputValue] = useState("100");

  const inputRef = useRef<HTMLInputElement>(null);
  const inputDebounceTimerRef = useRef<number | null>(null);

  // Load history from localStorage on component mount
  useEffect(() => {
    const storedHistory = localStorage.getItem("customPracticeHistory");
    if (storedHistory) {
      try {
        setHistory(JSON.parse(storedHistory));
      } catch (e) {
        console.error("Failed to parse history from localStorage", e);
        // Reset history if parsing fails
        localStorage.removeItem("customPracticeHistory");
      }
    }
  }, []);

  // Load word list from JSON file on component mount
  useEffect(() => {
    const fetchWordList = async () => {
      setWordListLoading(true);
      setWordListError(null);

      try {
        const response = await fetch(
          "/charachorder/word_lists/most-common-words-1k.json"
        );
        if (!response.ok) {
          throw new Error(
            `Failed to fetch word list: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();
        setWordList(data);
      } catch (error) {
        console.error("Error loading word list:", error);
        setWordListError(
          error instanceof Error
            ? error.message
            : "Unknown error loading word list"
        );
      } finally {
        setWordListLoading(false);
      }
    };

    fetchWordList();
  }, []);

  // Handle interleave count change with validation
  const handleInterleaveCountChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const inputValue = e.target.value;

    // Always update the input field value
    setInterleaveInputValue(inputValue);

    // Handle empty input (for when users are backspacing)
    if (inputValue === "") {
      return;
    }

    const numValue = parseInt(inputValue);

    // Update actual interleave count only when we have a valid number
    if (!isNaN(numValue)) {
      // Clamp the value between 1 and 10
      const clampedValue = Math.min(10, Math.max(1, numValue));
      setInterleaveCount(clampedValue);
    }
  };

  // Toggle interleave mode
  const toggleInterleave = () => {
    // If turning on interleave, turn off repeat
    if (!isInterleaved) {
      setIsRepeated(false);
    }
    setIsInterleaved(!isInterleaved);
  };

  // Toggle repeat mode
  const toggleRepeat = () => {
    // If turning on repeat, turn off interleave
    if (!isRepeated) {
      setIsInterleaved(false);
    }
    setIsRepeated(!isRepeated);
  };

  // When modal opens, sync the interleaveInputValue with interleaveCount
  useEffect(() => {
    if (showModal) {
      setInterleaveInputValue(interleaveCount.toString());
    }
  }, [showModal, interleaveCount]);

  // Save a new entry to history
  const addToHistory = (text: string) => {
    const newEntry: HistoryEntry = {
      text,
      date: new Date().toLocaleString(),
    };

    // Add new entry to beginning, limit to 10 items
    const updatedHistory = [newEntry, ...history].slice(0, 10);
    setHistory(updatedHistory);

    // Save to localStorage
    localStorage.setItem(
      "customPracticeHistory",
      JSON.stringify(updatedHistory)
    );
  };

  // Process text into units (words or letters) when submitted
  const processText = () => {
    if (!inputText.trim()) return;

    // Ensure we have a valid interleave count before starting
    if (interleaveInputValue === "" || isNaN(parseInt(interleaveInputValue))) {
      setInterleaveCount(3); // Reset to default if invalid
      setInterleaveInputValue("3");
    }

    // Add to history
    addToHistory(inputText);

    // Split by whitespace and filter out empty strings
    const processedUnits = inputText
      .trim()
      .split(/\s+/)
      .filter((unit) => unit);

    let finalUnits = [...processedUnits];

    // Apply shuffle first if enabled
    if (isShuffled) {
      // Fisher-Yates shuffle algorithm
      for (let i = finalUnits.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [finalUnits[i], finalUnits[j]] = [finalUnits[j], finalUnits[i]];
      }
    }

    // Apply repeat if enabled
    if (isRepeated && finalUnits.length > 0) {
      const repeatedUnits = [];

      // For each unit, repeat it interleaveCount times in sequence
      for (const unit of finalUnits) {
        for (let i = 0; i < interleaveCount; i++) {
          repeatedUnits.push(unit);
        }
      }

      finalUnits = repeatedUnits;
    }
    // Then apply interleaving if enabled (using the potentially shuffled units)
    else if (isInterleaved && finalUnits.length > 1) {
      // Create a pattern where each unit appears the specified number of times,
      // interleaved with other units to create contextual switching
      const interleavedUnits = [];

      // For each unit, add it interleaveCount times with other units in between
      for (let i = 0; i < finalUnits.length; i++) {
        // Get the current unit
        const current = finalUnits[i];

        // Get neighboring units (with wraparound)
        const next =
          i < finalUnits.length - 1 ? finalUnits[i + 1] : finalUnits[0];

        // Add current unit and interleave with next unit
        for (let rep = 0; rep < interleaveCount; rep++) {
          // Add current unit
          interleavedUnits.push(current);

          // Add next unit for interleaving (except after the last repetition)
          if (rep < interleaveCount - 1) {
            interleavedUnits.push(next);
          }
        }
      }

      finalUnits = interleavedUnits;
    }

    setUnits(finalUnits);
    setCurrentUnitIndex(0);
    setUserInput("");
    setPracticeActive(true);
    setShowModal(false);

    // Focus the input field after modal closes
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 100);
  };

  // Apply a history entry
  const applyHistoryEntry = (entry: HistoryEntry) => {
    setInputText(entry.text);
    setShowHistoryModal(false);
    setShowModal(true);
  };

  // Handle user input with debouncing and trimming
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Master mode: check if the input is correct so far
    if (masterMode) {
      const currentUnit = units[currentUnitIndex];

      if (requireTrailingSpace) {
        // In trailing space mode, allow the unit itself plus an optional trailing space
        if (value === currentUnit || value === `${currentUnit} `) {
          // Valid input: either the exact unit or unit plus space
          setUserInput(value);

          // If we have the unit plus space, match is complete
          if (value === `${currentUnit} `) {
            advanceToNextUnit(value.length);
            return;
          }
        } else if (currentUnit.startsWith(value)) {
          // Valid partial input
          setUserInput(value);
        } else {
          // Invalid input, reset
          setUserInput("");
          return;
        }
      } else {
        // Regular master mode (no trailing space required)
        // Check if the input is a valid prefix of the current unit
        if (!currentUnit.startsWith(value)) {
          // Reset input if typed character is incorrect
          setUserInput("");
          return;
        }
        setUserInput(value);
      }
    } else {
      setUserInput(value);
    }

    // For other cases, use debouncing to handle complex scenarios
    // Clear any existing debounce timer
    if (inputDebounceTimerRef.current) {
      clearTimeout(inputDebounceTimerRef.current);
    }

    // Set a new debounce timer (100ms delay)
    inputDebounceTimerRef.current = setTimeout(() => {
      // Trim the input value to handle leading/trailing whitespace
      const trimmedValue = value.trim();

      // Only check match if we have input after trimming
      if (trimmedValue) {
        checkForMatch(trimmedValue, value);
      }
    }, 100);
  };

  // Check if input matches current unit
  const checkForMatch = (trimmedValue: string, originalValue: string) => {
    const currentUnit = units[currentUnitIndex];

    // Match conditions vary based on trailing space requirement
    if (requireTrailingSpace) {
      // Only match if there's a trailing space
      if (originalValue === `${currentUnit} `) {
        advanceToNextUnit(trimmedValue.length);
      }
    } else {
      // Match conditions without trailing space requirement:
      // 1. Trimmed input matches exactly (handles leading/trailing spaces)
      // 2. Original input with a trailing space (for chorded input)
      // 3. Original input itself (direct match)
      if (
        trimmedValue === currentUnit ||
        originalValue === `${currentUnit} ` ||
        originalValue === currentUnit
      ) {
        advanceToNextUnit(trimmedValue.length);
      }
    }
  };

  // Advance to the next unit
  const advanceToNextUnit = (numberOfCharactersInCurrentTextInput: number) => {
    // Also clear any pending debounce timer
    if (inputDebounceTimerRef.current) {
      clearTimeout(inputDebounceTimerRef.current);
      inputDebounceTimerRef.current = null;
    }

    // Move to next unit or loop back to the beginning
    if (currentUnitIndex < units.length - 1) {
      setCurrentUnitIndex((prev) => prev + 1);
    } else {
      // Loop back to the first unit
      setCurrentUnitIndex(0);
      setCompletedCycles((prev) => prev + 1);

      // Show cycle completion notification
      setShowCycleNotification(true);
      setTimeout(() => {
        setShowCycleNotification(false);
      }, 1500);
    }

    // Wait a short time before clearing the input field
    // This gives CharaChorder time to finish its input process
    const tenMsPerCharacter = numberOfCharactersInCurrentTextInput * 10;
    setTimeout(() => {
      setUserInput("");
    }, tenMsPerCharacter);
  };

  // Handle key press in the input field
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Clear input when ESC key is pressed
    if (e.key === "Escape") {
      setUserInput("");

      // Also clear any pending debounce timer
      if (inputDebounceTimerRef.current) {
        clearTimeout(inputDebounceTimerRef.current);
        inputDebounceTimerRef.current = null;
      }
    }
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (inputDebounceTimerRef.current) {
        clearTimeout(inputDebounceTimerRef.current);
      }
    };
  }, []);

  // Reset practice
  const resetPractice = () => {
    setUnits([]);
    setCurrentUnitIndex(0);
    setUserInput("");
    setPracticeActive(false);
    setCompletedCycles(0);
  };

  // Start new practice
  const openInputModal = () => {
    setShowModal(true);
    setInputText("");
  };

  // Effect to focus input when practice is active
  useEffect(() => {
    if (practiceActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [practiceActive, currentUnitIndex]);

  // Handle word count input change with validation
  const handleWordCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Always update the input field value
    setWordCountInputValue(inputValue);

    // Handle empty input
    if (inputValue === "") {
      return;
    }

    const numValue = parseInt(inputValue);

    // Update only when we have a valid number
    if (!isNaN(numValue)) {
      // Clamp between 1 and max available words
      const maxWords = wordList.length;
      const clampedValue = Math.min(maxWords, Math.max(1, numValue));
      setSelectedWordCount(clampedValue);

      // Update the input value if it was clamped
      if (clampedValue !== numValue) {
        setWordCountInputValue(clampedValue.toString());
      }
    }
  };

  // Load selected number of words from the word list
  const loadWordsFromList = () => {
    if (wordList.length === 0) {
      setWordListError("Word list is empty");
      return;
    }

    // Get the requested number of words (clamped to the list size)
    const wordsToLoad = Math.min(selectedWordCount, wordList.length);

    // Extract words and join with spaces
    const selectedWords = wordList
      .slice(0, wordsToLoad)
      .map((entry) => entry.Word)
      .join(" ");

    // Set the text and open the custom text modal
    setInputText(selectedWords);
    setShowWordListModal(false);
    setShowModal(true);
  };

  // Open word list selection modal
  const openWordListModal = () => {
    setWordCountInputValue(selectedWordCount.toString());
    setShowWordListModal(true);
  };

  return (
    <div className="custom-practice">
      <h2>Custom Practice</h2>

      {!practiceActive && (
        <div className="practice-controls">
          <button onClick={openInputModal} className="primary-button">
            Add Custom Text
          </button>
          <button
            onClick={openWordListModal}
            className="primary-button"
            disabled={wordListLoading || wordList.length === 0}
          >
            Load Word List
            {wordListLoading && " (Loading...)"}
          </button>
        </div>
      )}

      {practiceActive && (
        <div className="practice-area">
          <div className="units-display">
            {/* Previous Unit */}
            <div
              className={`unit previous-unit ${
                currentUnitIndex > 0 ? "" : "empty-unit"
              }`}
            >
              {currentUnitIndex > 0 && (
                <>
                  <h4>Previous</h4>
                  <div className="unit-text">{units[currentUnitIndex - 1]}</div>
                </>
              )}
            </div>

            {/* Current Unit */}
            <div className="unit current-unit">
              <h4>Current</h4>
              <div className="unit-text">{units[currentUnitIndex]}</div>
            </div>

            {/* Next Unit */}
            <div
              className={`unit next-unit ${
                currentUnitIndex < units.length - 1 ? "" : "empty-unit"
              }`}
            >
              {currentUnitIndex < units.length - 1 && (
                <>
                  <h4>Next</h4>
                  <div className="unit-text">{units[currentUnitIndex + 1]}</div>
                </>
              )}
            </div>
          </div>

          {/* Unit counter below the units display */}
          <div className="unit-counter">
            Unit {currentUnitIndex + 1} of {units.length}
            {completedCycles > 0 && ` (Cycles completed: ${completedCycles})`}
          </div>

          <div className="input-area">
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              placeholder="Type the unit shown above... (Press ESC to clear)"
              autoFocus
            />
          </div>

          <button onClick={resetPractice} className="secondary-button">
            Reset Practice
          </button>
        </div>
      )}

      {/* Cycle notification - moved outside of practice area */}
      {showCycleNotification && (
        <div className="cycle-notification">
          Cycle completed! Starting again...
        </div>
      )}

      {!practiceActive && units.length > 0 && (
        <div className="practice-complete">
          <p>{units.length > 0 ? "Practice complete!" : ""}</p>
          <button
            onClick={() => {
              setCurrentUnitIndex(0);
              setUserInput("");
              setPracticeActive(true);
            }}
            className="primary-button"
          >
            Restart Practice
          </button>
        </div>
      )}

      {/* Bottom buttons - always visible */}
      <div className="bottom-buttons">
        <button
          onClick={() => setShowHistoryModal(true)}
          className="secondary-button"
        >
          History
        </button>
      </div>

      {/* Modal for text input */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Enter Custom Practice Text</h3>
            <p>Enter space-separated words or letters for practice:</p>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g., 'th he in an on' or 'a b c d e'"
              rows={5}
              autoFocus
            />

            <div className="modal-options">
              <label>
                <input
                  type="checkbox"
                  checked={isShuffled}
                  onChange={() => setIsShuffled(!isShuffled)}
                />
                Shuffle Units
              </label>
              <div className="interleave-option">
                <label>
                  <input
                    type="checkbox"
                    checked={isInterleaved}
                    onChange={toggleInterleave}
                  />
                  Interleave Units
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={isRepeated}
                    onChange={toggleRepeat}
                  />
                  Repeat Units
                </label>
                {(isInterleaved || isRepeated) && (
                  <div className="interleave-count">
                    <label htmlFor="interleave-count">Repetitions:</label>
                    <input
                      id="interleave-count"
                      type="number"
                      min="1"
                      max="10"
                      value={interleaveInputValue}
                      onChange={handleInterleaveCountChange}
                      onBlur={() => {
                        // When focus leaves the input, ensure we have a valid value
                        if (
                          interleaveInputValue === "" ||
                          isNaN(parseInt(interleaveInputValue))
                        ) {
                          setInterleaveInputValue(interleaveCount.toString());
                        } else {
                          // Make sure the displayed value matches the actual count
                          setInterleaveInputValue(interleaveCount.toString());
                        }
                      }}
                    />
                  </div>
                )}
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={masterMode}
                  onChange={() => setMasterMode(!masterMode)}
                />
                Master Mode
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={requireTrailingSpace}
                  onChange={() =>
                    setRequireTrailingSpace(!requireTrailingSpace)
                  }
                />
                Require Trailing Space
              </label>
              <div className="mode-description">
                {masterMode && (
                  <p className="master-mode-info">
                    In Master Mode, any incorrect keystroke will reset your
                    input
                  </p>
                )}
                {requireTrailingSpace && (
                  <p className="trailing-space-info">
                    Must end each unit with a space to proceed
                  </p>
                )}
              </div>
            </div>

            <div className="modal-buttons">
              <button
                onClick={() => setShowModal(false)}
                className="secondary-button"
              >
                Cancel
              </button>
              <button onClick={processText} className="primary-button">
                Start Practice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Practice History</h3>
            <p>Click an entry to use it again:</p>

            <div className="history-entries">
              {history.length > 0 ? (
                history.map((entry, index) => (
                  <div
                    key={index}
                    className="history-entry"
                    onClick={() => applyHistoryEntry(entry)}
                  >
                    <div className="history-text">
                      {entry.text.length > 50
                        ? `${entry.text.substring(0, 50)}...`
                        : entry.text}
                    </div>
                    <div className="history-date">{entry.date}</div>
                  </div>
                ))
              ) : (
                <p className="no-history">No history entries yet</p>
              )}
            </div>

            <div className="modal-buttons">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="secondary-button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Word List Selection Modal */}
      {showWordListModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Load Common Words</h3>
            <p>Select how many common words to load for practice:</p>

            {wordListError && (
              <div className="error-message">Error: {wordListError}</div>
            )}

            <div className="word-count-selection">
              <label htmlFor="word-count">Number of words:</label>
              <input
                id="word-count"
                type="number"
                min="1"
                max={wordList.length}
                value={wordCountInputValue}
                onChange={handleWordCountChange}
                onBlur={() => {
                  // Ensure valid value on blur
                  if (
                    wordCountInputValue === "" ||
                    isNaN(parseInt(wordCountInputValue))
                  ) {
                    setWordCountInputValue(selectedWordCount.toString());
                  }
                }}
              />
              <span className="max-words-info">(Max: {wordList.length})</span>
            </div>

            <div className="modal-buttons">
              <button
                onClick={() => setShowWordListModal(false)}
                className="secondary-button"
              >
                Cancel
              </button>
              <button
                onClick={loadWordsFromList}
                className="primary-button"
                disabled={wordList.length === 0}
              >
                Load Words
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
