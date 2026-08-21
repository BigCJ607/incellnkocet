export function getShortBranch(branch?: string | null): string {
  if (!branch) return 'N/A'
  
  const shortMap: Record<string, string> = {
    'Computer Science & Engineering': 'CSE',
    'Artificial Intelligence & Data Science': 'AIDS',
    'Electronics & Telecommunication': 'ENTC',
    'Electrical Engineering': 'EE',
    'Mechanical Engineering': 'ME',
    'Civil Engineering': 'CE'
  }
  
  return shortMap[branch] || branch
}
