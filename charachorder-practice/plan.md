# CharaChorder Anki Memory System Expansion Plan

## Overview
This document outlines the plan to expand the CharaChorder practice application by adding chord practice capabilities to the existing Anki memory system.

## Current System
- The application currently has an AnkiMemorySystem component for practicing individual letters
- Uses spaced repetition for efficient learning
- Tracks user progress with a 1-4 rating system
- Stores progress in localStorage

## Expansion Goals ✅
- Add a new chord practice system
- Maintain separate progress tracking for letters and chords
- Keep the familiar Anki-style interface and rating system
- Optimize the learning experience for chord combinations

## Implementation Phases

### Phase 1: Create the Chord Practice Component ✅

1. **Create a ChordAnkiSystem component**: ✅
   - Copy and adapt the existing AnkiMemorySystem
   - Modify it to handle chord data from mostUsedChords.tsx
   - Update input handling to check if all required letters are pressed
   - Use a separate localStorage key ("charachorder_anki_chord_system")

2. **Create the UI for Chord Practice**: ✅
   - Display the target word
   - Show the chord letters required
   - Add a text input field for user input
   - Keep the 1-4 rating system

**Completed Implementation Details:**
- Created ChordAnkiSystem.tsx component
- Created ChordAnkiSystem.css for styling
- Implemented chord-specific input handling
- Set up spaced repetition system for chord practice
- Created proper data structures for chord cards
- Added filtering to exclude empty chords

### Phase 2: Update Tab Navigation ✅

1. **Modify PracticeTabs.tsx**: ✅
   - Add new tabs for Letters and Chords
   - Restructure to show Practice/View Deck within each category
   - Update the router/state to handle the new navigation structure

2. **Update navigation UX**: ✅
   - Create a consistent navigation path for both systems
   - Ensure clear visual indication of which system the user is in

**Completed Implementation Details:**
- Updated PracticeTabs.tsx to support main tabs and subtabs
- Updated PracticeTabs.css with styling for the subtabs
- Implemented state management for both main tabs and subtabs
- Created conditional rendering logic for the appropriate component

### Phase 3: Enhance and Polish ✅

1. **Improve Feedback Mechanisms**: ✅
   - Adapted practice UI based on CharaChorder workflow
   - Implemented direct keyboard shortcut rating (1-4 keys)
   - Designed a practice-focused input field without automated validation

2. **UX Improvements**: ✅
   - Added clear rating instructions
   - Simplified the practice workflow for CharaChorder users
   - Updated visual indicators for the rating options
   - Implemented global keyboard handler for direct rating

**Refinements to Original Plan:**
- Modified the workflow to better match actual CharaChorder usage
- Created a simpler input system that doesn't track correct/incorrect inputs
- Allowed users to self-report their practice results using number keys
- Made the rating system more accessible with keyboard shortcuts

## Technical Implementation Details

### Component Structure
```
PracticeTabs
├── Letters
│   ├── AnkiMemorySystem (existing)
│   └── (has its own Practice/View Deck tabs)
└── Chords
    ├── ChordAnkiSystem (new)
    └── (has its own Practice/View Deck tabs)
```

### Data Structure
1. **ChordCardState**:
   ```typescript
   interface ChordCardState {
     word: string;
     chord: string[];
     rank: number;
     interval: number;
     nextReviewTime: number;
     lastReviewed: number;
     ease: number;
     totalAttempts: number;
     correctAttempts: number;
     state: "new" | "learning" | "review";
     intervalLevel: number;
   }
   ```

2. **Chord System State**:
   ```typescript
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
   ```

### User Workflow
1. User is presented with a word and its chord letters
2. User practices typing the chord in the input field
3. When ready, user presses 1-4 to rate their performance
4. System uses the rating to schedule the next review
5. System immediately advances to the next due card

### Storage
- Use separate localStorage keys:
  - "charachorder_anki_system" (existing for letters)
  - "charachorder_anki_chord_system" (new for chords)

## Success Metrics
- User can efficiently practice both letters and chords
- Progress on each system is tracked independently
- Learning curve is optimized through the spaced repetition system
- UI provides clear feedback on progress and accuracy

## Future Enhancements
- Add statistics visualization comparing letter vs chord proficiency
- Allow importing custom chord sets
- Add settings for adjusting difficulty
- Create a combined dashboard for overall progress tracking 