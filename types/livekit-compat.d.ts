// Compatibility shim: provide a runtime value for VideoGrant in case some code
// (or generated artifacts) attempts to use it as a value rather than a type.
// Declare a minimal class so `new VideoGrant(...)` is permitted by the type checker.
declare class VideoGrant {
	constructor(...args: any[]);
}
export {};
