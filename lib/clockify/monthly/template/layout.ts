/** Fixed shape of the Monthly Report's Detailed Report sheet — the same 7 columns, in the
 * same order, every month. Column order here is load-bearing: it must match the pivot
 * field order in pivot.ts (Project=0, Client=1, Description=2, Task=3, User=4,
 * Duration=5, NS=6) since the template's rowFields/dataFields reference fields by this
 * positional index, not by name. */
export const DETAILED_REPORT_HEADERS = ["Project", "Client", "Description", "Task", "User", "Duration (decimal)", "NS"] as const;

export const COLUMN_LETTERS = ["A", "B", "C", "D", "E", "F", "G"] as const;
