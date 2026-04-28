export const formatLocalTime = (utcString) => {
    if (!utcString) return "";

    const [datePart, timePart] = utcString.split("T");
    const [year, month, day] = datePart.split("-");
    let [hour, minute] = timePart.split(":");

    hour = parseInt(hour, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;

    return `${day}/${month}/${year} ${hour}:${minute} ${ampm}`;
};

export const convertToUTC = (localDateTimeStr) => {
    if (!localDateTimeStr) return "";
    const localDate = new Date(localDateTimeStr);
    return new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000).toISOString();
};
