const fs = require("fs");
const lines = fs.readFileSync("c:/Users/ADEEL/AppData/Roaming/Code/User/workspaceStorage/59699d21ccf90762e9d123fb9d5cf45d/GitHub.copilot-chat/transcripts/4692df1c-211a-4929-a725-fcaa60942e8a.jsonl", "utf8").split("\n");

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("edge")) {
    console.log("--- FOUND AT LINE " + i + " ---");
    const start = Math.max(0, i - 2);
    const end = Math.min(lines.length, i + 5);
    for (let j = start; j < end; j++) {
      console.log(lines[j]);
    }
  }
}
