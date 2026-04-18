const fs = require('fs');
const content = fs.readFileSync('src/features/profile/screens/EmailRecoveryScreen.tsx', 'utf8');

const target = \            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  const createStyles = (colors: ThemeColors) =>\;

const replacement = \            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.installButton,
                styles.syncButton,
                (!smartAccountReady || !guardiansReady || installingModule) && styles.installButtonDisabled,
              ]}
              disabled={!smartAccountReady || !guardiansReady || installingModule}
              onPress={handleSaveToCloud}
              activeOpacity={0.85}
            >
              {installingModule ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.installButtonText}>Save / Sync Cloud Metadata</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  const createStyles = (colors: ThemeColors) =>\;

const newContent = content.replace(target, replacement);

const stylesTarget = \    installButtonText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "700",
    },
  });\;

const stylesReplacement = \    installButtonText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "700",
    },
    syncButton: {
      backgroundColor: colors.accent,
      marginTop: 12,
    },
  });\;

const finalContent = newContent.replace(stylesTarget, stylesReplacement);
fs.writeFileSync('src/features/profile/screens/EmailRecoveryScreen.tsx', finalContent);
console.log('Modified email recovery screen.');
