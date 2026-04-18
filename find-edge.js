const fs = require("fs");
const transcriptPath = "c:/Users/ADEEL/AppData/Roaming/Code/User/workspaceStorage/59699d21ccf90762e9d123fb9d5cf45d/GitHub.copilot-chat/transcripts/4692df1c-211a-4929-a725-fcaa60942e8a.jsonl";
const lines = fs.readFileSync(transcriptPath, "utf8").split("\n");

for (let i = 0; i < lines.length; i++) {
  if (lines[i].toLowerCase().includes("edge")) {
    console.log("--- MATCH ---");
    const json = JSON.parse(lines[i]);
    if (json.data && json.data.content) {
      console.log(json.data.content.substring(0, 500));
    } else {
      console.log(lines[i].substring(0, 200));
    }
  }
}
