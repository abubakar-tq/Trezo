const fs = require("fs");
let content = fs.readFileSync("src/features/profile/services/ProfileSyncService.ts", "utf8");

content = content.replace("const fileName = `${userId}-${Date.now()}.${fileExt}`;", "const filePath = `avatars/${userId}`;");
content = content.replace("const filePath = `avatars/${fileName}`;", "");

content = content.replace("const { data: { publicUrl } } = this.supabase.storage", "const { data: { publicUrl: rawPublicUrl } } = this.supabase.storage");
content = content.replace(".from('profiles')\\n        .getPublicUrl(filePath);", ".from('profiles')\\n        .getPublicUrl(filePath);\\n\\n      const publicUrl = rawPublicUrl + \"?t=\" + Date.now();");
// Actually the previous replacement probably didn`t work either.
// Let`s just use regex with wildcards for the publicUrl replacement.
content = content.replace(/const \{ data: \{ publicUrl \} \} = this\.supabase\.storage\s*\.from\('profiles'\)\s*\.getPublicUrl\(filePath\);/, 
  "const { data: { publicUrl: rawPublicUrl } } = this.supabase.storage.from(\\\"profiles\\\").getPublicUrl(filePath);\\n      const publicUrl = rawPublicUrl + \\\"?t=\\\" + Date.now();");

fs.writeFileSync("src/features/profile/services/ProfileSyncService.ts", content);
console.log("Re-ran fix");
