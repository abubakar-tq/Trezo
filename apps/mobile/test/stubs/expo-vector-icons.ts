/**
 * Test stub for `@expo/vector-icons`.
 * The real package ships JS with JSX syntax that esbuild/tsx cannot transform.
 * Under Node tests, icon components are never rendered — stub them as no-ops.
 */
export const Feather = () => null;
export const Ionicons = () => null;
export const MaterialIcons = () => null;
export const FontAwesome = () => null;
export const AntDesign = () => null;
export default { Feather, Ionicons, MaterialIcons, FontAwesome, AntDesign };
