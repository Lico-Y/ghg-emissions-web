/** @type {Record<string, string>} */
export const sectorDisplayNames = {
    "Wholesale and Retail Trade; Repair of Motor Vehicles and Motorcycles":
        "Wholesale & Retail Trade",

    "Water Supply; Sewerage, Waste Management and Remediation Activities":
        "Water & Waste Management",

    "Public Administration and Defence; Compulsory Social Security":
        "Public Administration & Defence",

    "Electricity, Gas, Steam and Air Conditioning Supply":
        "Electricity & Gas Supply",

    "Professional, Scientific and Technical Activities":
        "Professional & Technical",

    "Administrative and Support Service Activities":
        "Administrative Support",

    "Accommodation and Food Service Activities":
        "Accommodation & Food",

    "Human Health and Social Work Activities":
        "Health & Social Work",

    "Arts, Entertainment and Recreation":
        "Arts & Recreation",

    "Financial and Insurance Activities":
        "Finance & Insurance",

    "Agriculture, Forestry and Fishing":
        "Agriculture & Forestry",

    "Other Personal Service Activities":
        "Other Personal Services",

    "Information and Communication":
        "Information & Communication",

    "Transportation and Storage":
        "Transport & Storage"
};
/**
 * @param {string} name
 * @returns {string}
 */
export function getSectorDisplayName(name) {
    return sectorDisplayNames[name] ?? name;
}
