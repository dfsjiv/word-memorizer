const INTERVALS = [0, 1, 1, 2, 3, 5, 8, 14, 21, 30, 45, 60, 90]

export const localDate = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const addDays = (days: number) => {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return localDate(date)
}

export const intervalForExposure = (count: number) => INTERVALS[Math.min(Math.max(count, 0), INTERVALS.length - 1)]

export const nextReviewDate = (count: number) => addDays(intervalForExposure(count))
