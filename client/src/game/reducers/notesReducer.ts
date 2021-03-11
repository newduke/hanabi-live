import equal from "fast-deep-equal";
import produce, { Draft } from "immer";
import { getVariant } from "../data/gameData";
import { ensureAllCases } from "../../misc";
import { NoteAction } from "../types/actions";
import CardNote from "../types/CardNote";
import GameMetadata from "../types/GameMetadata";
import NotesState from "../types/NotesState";
import Variant from "../types/Variant";
import * as noteIdentity from "./noteIdentity";

const notesReducer = produce(notesReducerFunction, {} as NotesState);
const emptyNotes: Map<string, CardNote> = new Map<string, CardNote>();
export default notesReducer;

function notesReducerFunction(
  notes: Draft<NotesState>,
  action: NoteAction,
  metadata: GameMetadata,
  playing: boolean,
  finished: boolean,
) {
  const variant = getVariant(metadata.options.variantName);
  switch (action.type) {
    case "setEffMod": {
      notes.efficiencyModifier = action.mod;
      console.log(action.mod);
      break;
    }

    case "editNote": {
      notes.ourNotes[action.order] = parseNote(variant, action.text);

      if (!playing) {
        for (const specNote of notes.allNotes[action.order]) {
          if (specNote.name === metadata.ourUsername) {
            specNote.text = action.text;
          }
        }
      }

      break;
    }

    case "noteListPlayer": {
      action.texts.forEach((text, i) => {
        notes.ourNotes[i] = parseNote(variant, text);
      });
      break;
    }

    case "receiveNote": {
      // Add in the notes received from server
      notes.allNotes[action.order] = action.notes;
      break;
    }

    case "noteList": {
      // Reset any existing notes
      for (let i = 0; i < notes.allNotes.length; i++) {
        notes.allNotes[i] = [];
      }

      // Set the new notes
      action.noteTextLists.forEach((noteTextList, i) => {
        // If we are a spectator, copy our notes from combined list
        if (action.names[i] === metadata.ourUsername && !playing && !finished) {
          noteTextList.forEach((text, order) => {
            notes.ourNotes[order] = parseNote(variant, text);
          });
        }

        noteTextList.forEach((text, order) => {
          notes.allNotes[order].push({
            name: action.names[i],
            text,
          });
        });
      });
      break;
    }

    default: {
      ensureAllCases(action);
      break;
    }
  }
}

function getNoteKeywords(note: string) {
  // Match either:
  // - zero or more characters between square brackets `[]`
  //   - \[(.*?)\]
  // - zero or more non-pipe non-bracket characters between a pipe `|` and the end of the note
  //   - \|([^[|]*$)
  // - one or more non-pipe non-bracket characters between the start and end of the note
  //   - (^[^[|]+$)
  const regexp = /\[(.*?)\]|\|([^[|]*$)|(^[^[|]+$)/g;
  const keywords = [];

  let match = regexp.exec(note);
  while (match !== null) {
    if (match[1] !== undefined) {
      keywords.push(match[1].trim());
    } else if (match[2] !== undefined) {
      keywords.push(match[2].trim());
    } else {
      keywords.push(match[3].trim());
    }
    match = regexp.exec(note);
  }

  return keywords;
}

const checkNoteKeywordsForMatch = (patterns: string[], keywords: string[]) =>
  keywords.some((k) => patterns.some((pattern) => k === pattern));

function getEmptyNote(variant: Variant): CardNote {
  const note: CardNote = emptyNotes.get(variant.name) ?? parseNote(variant, "");
  emptyNotes.set(variant.name, note);
  return note;
}

function noteWithoutText(note: CardNote): CardNote {
  interface CardNoteModifiable {
    possibilities: Array<[number, number]>;
    knownTrash: boolean;
    needsFix: boolean;
    chopMoved: boolean;
    finessed: boolean;
    blank: boolean;
    unclued: boolean;
    text: string;
  }
  const newNote: CardNoteModifiable = note;
  newNote.text = "";
  return newNote;
}

export function noteEqual(note1: CardNote, note2: CardNote): boolean {
  return equal(noteWithoutText(note1), noteWithoutText(note2));
}

export function noteHasMeaning(variant: Variant, note: CardNote): boolean {
  return !noteEqual(noteWithoutText(note), getEmptyNote(variant));
}

export function parseNote(variant: Variant, text: string): CardNote {
  // Make all letters lowercase to simply the matching logic below
  // and remove all leading and trailing whitespace
  const pipeIdx = text.lastIndexOf("|");
  const lastPipe = text.slice(pipeIdx >= 0 ? pipeIdx + 1 : 0);
  const fullNote = lastPipe.toLowerCase().trim();
  const keywords = getNoteKeywords(fullNote);
  const possibilities = noteIdentity.getPossibilitiesFromKeywords(
    variant,
    keywords,
  );

  const chopMoved = checkNoteKeywordsForMatch(
    [
      "cm",
      "chop move",
      "chop moved",
      "5cm",
      "e5cm",
      "tcm",
      "tccm",
      "sdcm",
      "sbpcm",
      "ocm",
      "tocm",
      "utfcm",
      "utbcm",
    ],
    keywords,
  );
  const finessed = checkNoteKeywordsForMatch(["f", "hf", "pf", "gd"], keywords);
  const knownTrash = checkNoteKeywordsForMatch(
    ["kt", "trash", "stale", "bad"],
    keywords,
  );
  const needsFix = checkNoteKeywordsForMatch(
    ["fix", "fixme", "needs fix"],
    keywords,
  );
  const blank = checkNoteKeywordsForMatch(["blank"], keywords);
  const unclued = checkNoteKeywordsForMatch(["unclued"], keywords);

  return {
    possibilities,
    chopMoved,
    finessed,
    knownTrash,
    needsFix,
    blank,
    unclued,
    text,
  };
}
