import { useEffect, useState } from "react";

import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_700Bold, Inter_800ExtraBold } from "@expo-google-fonts/inter";
import { PlayfairDisplay_400Regular, PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display";
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";

import { useSupabaseAuth } from "./useSupabaseAuth";

export const useCachedResources = () => {
	const [isReady, setIsReady] = useState(false);
	const { loading: authLoading } = useSupabaseAuth();

	const [fontsLoaded, fontError] = useFonts({
		"Inter": Inter_400Regular,
		"Inter-Bold": Inter_700Bold,
		"Inter-ExtraBold": Inter_800ExtraBold,
		"PlayfairDisplay-Regular": PlayfairDisplay_400Regular,
		"PlayfairDisplay-Bold": PlayfairDisplay_700Bold,
		"JetBrainsMono-Regular": JetBrainsMono_400Regular,
		"JetBrainsMono-Medium": JetBrainsMono_500Medium,
	});

	useEffect(() => {
		if (!authLoading) {
			setIsReady(true);
		}
	}, [authLoading]);

	return isReady && (fontsLoaded || !!fontError);
};
