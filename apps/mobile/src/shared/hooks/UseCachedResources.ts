import { useEffect, useState } from "react";

import { useSupabaseAuth } from "./useSupabaseAuth";

export const useCachedResources = () => {
	const [isReady, setIsReady] = useState(false);
	const { loading: authLoading } = useSupabaseAuth();

	useEffect(() => {
		if (!authLoading) {
			setIsReady(true);
		}
	}, [authLoading]);

	return isReady;
};
