import { exec } from "child_process";
import {
  App,
    Editor,
    EditorPosition,
    EditorSuggest,
    EditorSuggestContext,
    EditorSuggestTriggerInfo,
    TFile
} from "obsidian";
import {posix, sep} from "path";


interface Match {
  path: string;
  text: string;
}

export default class SuggestionPopup extends EditorSuggest<Match> {
  vaultPath: string
  allHeaders: Match[] = [];
  partialMatch = "";

  constructor(app: App) {
    super(app);
    this.vaultPath = (this.app.vault.adapter as any).basePath;
    this.app.vault.getMarkdownFiles().forEach(f => this.allHeaders.push({ text: f.basename, path: f.path }))
    this.app.vault.on("create", (f) => {
      //console.log(f);
      this.allHeaders.push({ text: `${f.name.substring(0, f.name.length - 3)}`, path: `${this.vaultPath}\\${f.path}`});
    })
    this.grep_matcher();
  }

  async grep_matcher() {
    const path = this.vaultPath;
    const promise = new Promise<void>((rslv) => {

      exec(`rg --json "^#+ " ${path}`, (err, stdout, _) => {
        stdout.split("\n")
          .map(line =>{
          try {
            return JSON.parse(line)
          } catch (err){ /* empty */ }})
          .filter(l => l && l.type == "match")
          .forEach(m => {
            const text = m.data.lines.text as string
            const indexOfFirstSpace = text.indexOf(" ");
            const trimmedTxt = text.substring(indexOfFirstSpace).trim();
            this.allHeaders.push({text: trimmedTxt, path: m.data.path.text});
          })
          rslv()
      })


    })

    await promise;
	}

  matchWordBackwards(
      editor: Editor,
      cursor: EditorPosition,
      charPredicate: (char: string) => boolean,
      maxLookBackDistance = 50
  ): { query: string, separatorChar: string } {
      let query = "", separatorChar = null;

      // Save some time for very long lines
      const lookBackEnd = Math.max(0, cursor.ch - maxLookBackDistance);
      // Find word in front of cursor
      for (let i = cursor.ch - 1; i >= lookBackEnd; i--) {
          const prevChar = editor.getRange({ ...cursor, ch: i }, { ...cursor, ch: i + 1 });
          if (!charPredicate(prevChar) && this.partialMatch != "") {
              separatorChar = prevChar;
              break;
          }

          query = prevChar + query;
      }

      separatorChar = separatorChar ?? " "

      return { query, separatorChar };
  }

  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
    const { query } = this.matchWordBackwards(editor, cursor, (char) => true)
    return {
      start: {
        ...cursor,
      },
      end: cursor,
      query
    }
  }

  getSuggestions(context: EditorSuggestContext): Match[] | Promise<Match[]> {
    if (context.query == "") {
      return [];
    }
    let words = context.query.split(" ") ?? [context.query];
    words = words.filter(w => w != "");

    const match_count: Map<Match, number> = new Map();
    let backtrack = "";

    for (let i = words.length - 1; i >= 0; i--) {
      if (i == words.length - 1) {
        backtrack = words[i];
      } else {
        backtrack = words[i] + " " + backtrack;
      }

      const matches = this.allHeaders.filter(header => header.text.toLowerCase().contains(backtrack.toLowerCase()));
      if (matches.length != 0) {
        this.partialMatch = backtrack;
        matches.forEach(m => {
          const currentMatchValue = match_count.get(m) ?? 0;
          match_count.set(m, currentMatchValue+ 1);
        })
      } else {
        break;
      }
    }

    const m2= new Map([...match_count.entries()].sort((a,b) => b[1] - a[1]))

    if (m2.size == 0) {
      this.partialMatch = ""
    }
    
    return [...m2.keys()]; 
  }

  renderSuggestion(value: Match, el: HTMLElement): void {
    const text = el.doc.createElement("div")
    text.setText(value.text);
    el.appendChild(text);
  }

  selectSuggestion(value: Match, evt: MouseEvent | KeyboardEvent): void {
    if (!this.context) {
      return
    }

    // Convert from Windows to Unix path
    const matchPosixPath = value.path.split(sep).join(posix.sep);
    const vaultPosixPath = this.vaultPath.split(sep).join(posix.sep);
    let path_to_file = matchPosixPath.split(vaultPosixPath + "/")[1];
    path_to_file = path_to_file.substring(0, path_to_file.length - 3)

    const header = value.text;
    const finalString = `[[${path_to_file}#${header}|${header}]]`
    // 1256

    const cursor = this.context.editor.getCursor();
    this.context.editor.replaceRange(finalString, {...cursor, ch: cursor.ch - this.partialMatch.length}, cursor);

    this.partialMatch = "";
  }
}

export enum SelectionDirection {
    NEXT = 1,
    PREVIOUS = -1,
    NONE = 0,
}
