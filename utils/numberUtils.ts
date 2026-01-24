/**
 * Converts a number to Eastern Arabic numerals (٠-٩).
 * @param num The number to convert.
 * @returns The string with Eastern Arabic numerals.
 */
export function toArabicDigits(num: number | string): string {
    return String(num).replace(/\d/g, (d) =>
        String.fromCharCode(0x0660 + Number(d))
    );
}
