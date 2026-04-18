const fs = require("fs");
let content = fs.readFileSync("src/features/profile/screens/EmailRecoveryScreen.tsx", "utf8");

content = content.replace(/if \(parsedThreshold <= 0\) {\s+Alert\.alert\("Invalid Threshold", "Threshold must be greater than zero\."\);\s+return;\s+}\s+if \(hasDuplicateGuardians\) {/g, `if (parsedThreshold <= 0) {
      Alert.alert("Invalid Threshold", "Threshold must be greater than zero.");
      return;
    }
    
    const computedTotalWeight = guardianWeights
      .slice(0, expectedGuardians)
      .reduce((sum, weight) => sum + (parseInt(weight, 10) || 0), 0);

    if (parsedThreshold > computedTotalWeight) {
      Alert.alert(
        "Threshold Too High",
        "Threshold cannot exceed the total sum of guardian validation weights."
      );
      return;
    }

    if (hasDuplicateGuardians) {`);

fs.writeFileSync("src/features/profile/screens/EmailRecoveryScreen.tsx", content);
console.log("Validation replaced");
