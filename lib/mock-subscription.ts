const STORAGE_KEY = "lco_mock_is_pro";

export function getMockIsPro(): boolean {
	if (typeof window === "undefined") return false;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		return raw === "true";
	} catch {
		return false;
	}
}

export function setMockIsPro(value: boolean) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
	} catch {
		// ignore
	}
}

export function resetMockIsPro() {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.removeItem(STORAGE_KEY);
	} catch {
		// ignore
	}
}
