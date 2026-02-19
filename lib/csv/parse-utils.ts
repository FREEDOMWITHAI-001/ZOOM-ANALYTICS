import Papa from "papaparse";
import { AttendeeRecord } from "./types";

/**
 * Preprocess Zoom CSV file to handle files with meeting summary, host details,
 * and panelist details sections before the actual attendee data.
 * 
 * If "Attendee Details" is found in the file, only returns the CSV content
 * starting from that section.
 */
export const preprocessZoomCsv = (csvContent: string): string => {
  if (!csvContent || typeof csvContent !== 'string') {
    return csvContent;
  }

  console.log("Preprocessing CSV file...");
  
  // Split the content into lines
  const lines = csvContent.split(/\r?\n/);
  
  // Print the first few lines for debugging
  console.log("CSV first few lines:");
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    console.log(`Line ${i+1}: ${lines[i]}`);
  }
  
  // SOLUTION FOR "ATTENDEE DETAILS" SECTION ISOLATION:
  // 1. Find the "Attendee Details" line
  // 2. Extract only the header and data rows
  // 3. Process each line to remove trailing commas
  
  // Look for the "Attendee Details" marker - using both exact match and includes
  let attendeeDetailsIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "Attendee Details" || line.startsWith("Attendee Details")) {
      attendeeDetailsIndex = i;
      console.log(`Found "Attendee Details" at line ${i+1}`);
      break;
    }
  }
  
  // If we found the Attendee Details section
  if (attendeeDetailsIndex >= 0 && attendeeDetailsIndex < lines.length - 1) {
    console.log(`Processing attendance data starting at line ${attendeeDetailsIndex + 2}`);
    
    // Get the header row (line after "Attendee Details")
    let headerRow = lines[attendeeDetailsIndex + 1];
    
    // Process the header to ensure it has the expected columns
    if (headerRow && 
        (headerRow.toLowerCase().includes("join time") || 
         headerRow.toLowerCase().includes("leave time"))) {
      
      // Remove trailing comma from the header
      headerRow = headerRow.replace(/,\s*$/, '');
      
      // Get the data rows (everything after the header)
      let dataRows = lines.slice(attendeeDetailsIndex + 2)
        .filter(line => line.trim() !== '');
      
      // Process each data row to remove trailing commas
      dataRows = dataRows.map(line => line.replace(/,\s*$/, ''));
      
      console.log(`Found header: ${headerRow}`);
      console.log(`Found ${dataRows.length} data rows`);
      
      if (dataRows.length > 0) {
        console.log(`First data row: ${dataRows[0]}`);
      }
      
      // Create clean CSV content with just the header and data rows
      const processedCsv = [headerRow, ...dataRows].join("\n");
      console.log("Successfully extracted attendance data");
      return processedCsv;
    } else {
      console.warn("No valid header row found after 'Attendee Details'");
    }
  }
  
  console.log("Could not find 'Attendee Details' section. Trying alternate approach...");
  
  // ALTERNATE APPROACH: Find any suitable header row
  // Look for rows that contain key attendance data columns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.toLowerCase().includes("join time") && 
        line.toLowerCase().includes("leave time") &&
        line.toLowerCase().includes("attended")) {
      
      console.log(`Found likely header row at line ${i+1}`);
      
      // Check if there's a section marker above
      if (i > 0 && lines[i-1].toLowerCase().includes("details")) {
        console.log(`This appears to be part of the "${lines[i-1]}" section`);
      }
      
      // Fix trailing comma in header
      let headerRow = line.replace(/,\s*$/, '');
      
      // Get data rows after this header, also fixing trailing commas
      let dataRows = lines.slice(i+1)
        .filter(line => line.trim() !== '')
        .map(line => line.replace(/,\s*$/, ''));
      
      console.log(`Found ${dataRows.length} data rows after header`);
      
      if (dataRows.length > 0) {
        console.log(`First data row: ${dataRows[0]}`);
        const processedCsv = [headerRow, ...dataRows].join("\n");
        console.log("Successfully extracted attendance data using alternate method");
        return processedCsv;
      }
    }
  }
  
  console.log("WARNING: No attendance data section could be identified.");
  console.log("Processing file as-is, which may cause parsing errors.");
  return csvContent;
};

/**
 * Parse Zoom attendance CSV file.
 * Expected format has columns for join time and leave time.
 */
export const parseAttendanceCSV = (csvContent: string): AttendeeRecord[] => {
  // Preprocess the CSV content first to extract just the Attendee Details section
  const processedCsvContent = preprocessZoomCsv(csvContent);
  
  console.log("Starting CSV parsing. First 100 chars:", processedCsvContent.slice(0, 100));
  
  // Handle nested quotes in columns like 'Profession (if student mention "Student", not target profession)'
  // by temporarily replacing them with a placeholder
  let sanitizedCsv = processedCsvContent;
  
  // Replace escaped double quotes with a placeholder
  const QUOTE_PLACEHOLDER = "___QUOTE___";
  sanitizedCsv = sanitizedCsv.replace(/""([^"]*)""(?=[^"]*(?:"|$))/g, 
                                       (match) => match.replace(/"/g, QUOTE_PLACEHOLDER));
  
  // Parse CSV with Papa Parse using more robust settings
  const results = Papa.parse(sanitizedCsv, {
    header: true,
    skipEmptyLines: true,
    // Ignore trailing delimiter that could cause "too many fields" error
    delimiter: ",",
    // Allow inconsistent number of fields
    dynamicTyping: false,
    // Relax requirements
    quoteChar: '"',
    escapeChar: '\\',
    // Don't enforce strict column count
    fastMode: false,
    // Transform values
    transform: (value: any) => {
      if (typeof value === "string") {
        // Restore the placeholders back to double quotes
        return value.trim().replace(new RegExp(QUOTE_PLACEHOLDER, 'g'), '"');
      }
      return value;
    },
  });

  // Report parsing errors but don't fail unless there's no data
  if (results.errors && results.errors.length > 0) {
    console.warn("CSV parsing had non-critical errors:", results.errors);
    // Only throw an error if all rows failed to parse
    if (!results.data || results.data.length === 0) {
      throw new Error(`CSV parsing failed completely: ${results.errors.map((e) => e.message).join(", ")}`);
    }
  }
  
  if (!results.data || results.data.length === 0) {
    throw new Error("No data found in CSV file. Please ensure the file is not empty and is in CSV format.");
  }

  // Get headers (trimmed) from the first row
  const headers = Object.keys(results.data[0]).map((h) => String(h).trim());
  console.log("CSV Headers:", headers);
  console.log("Total rows parsed:", results.data.length);
  
  // Here are the specific columns we need to find based on the sample file:
  let attendedColumn = null;
  let nameColumn = null;
  let emailColumn = null;
  let joinTimeColumn = null;
  let leaveTimeColumn = null;
  let durationColumn = null;
  let countryColumn = null;
  let professionColumn = null;
  
  // Track all non-standard columns for customized visualization
  const standardColumns = [
    "attended", "user name", "first name", "last name", "email", "phone", 
    "registration time", "approval status", "join time", "leave time", 
    "time in session", "is guest"
  ];
  
  // Store all extra columns that will be part of the additional visualizations
  const extraColumns: string[] = [];
  
  // Map headers to expected columns - case insensitive matching
  headers.forEach(header => {
    const headerLower = header.toLowerCase();
    if (headerLower === "attended") {
      attendedColumn = header;
    } else if (headerLower === "user name (original name)" || headerLower.includes("user name")) {
      nameColumn = header;
    } else if (headerLower === "email") {
      emailColumn = header;
    } else if (headerLower === "join time") {
      joinTimeColumn = header;
    } else if (headerLower === "leave time") {
      leaveTimeColumn = header;
    } else if (headerLower === "time in session (minutes)" || headerLower.includes("minutes")) {
      durationColumn = header;
    } else if (headerLower.includes("country") || headerLower.includes("region")) {
      countryColumn = header;
      // Don't add country to extra columns since it will always have its own visualization
    } else if (headerLower.includes("profession") || headerLower.includes("occupation")) {
      professionColumn = header;
      extraColumns.push(header);
    } else if (!standardColumns.some(stdCol => headerLower.includes(stdCol))) {
      // This is an extra column that's not part of the standard Zoom format
      extraColumns.push(header);
    }
  });
  
  console.log("Column mapping results:");
  console.log("- Attended column:", attendedColumn);
  console.log("- Name column:", nameColumn);
  console.log("- Email column:", emailColumn);
  console.log("- Join time column:", joinTimeColumn);
  console.log("- Leave time column:", leaveTimeColumn);
  console.log("- Duration column:", durationColumn);
  console.log("- Country column:", countryColumn);
  console.log("- Profession column:", professionColumn);
  console.log("- Extra columns:", extraColumns);
  
  // Sample the first few rows to check column content
  if (results.data.length > 0) {
    const sample = results.data[0];
    console.log("First row sample:");
    if (nameColumn) console.log(`- Name: ${sample[nameColumn]}`);
    if (emailColumn) console.log(`- Email: ${sample[emailColumn]}`);
    if (joinTimeColumn) console.log(`- Join Time: ${sample[joinTimeColumn]}`);
    if (leaveTimeColumn) console.log(`- Leave Time: ${sample[leaveTimeColumn]}`);
    if (countryColumn) console.log(`- Country: ${sample[countryColumn]}`);
    if (professionColumn) console.log(`- Profession: ${sample[professionColumn]}`);
  }
  
  // Validate that we found the required columns
  if (!joinTimeColumn || !leaveTimeColumn) {
    throw new Error(
      "Could not find join time or leave time columns in CSV. " +
      "Expected columns: 'Join Time' and 'Leave Time'. " +
      "Available columns: " + headers.join(", ")
    );
  }
  
  if (!nameColumn) {
    throw new Error(
      "Could not find name column in CSV. " +
      "Expected a column containing 'name'. " +
      "Available columns: " + headers.join(", ")
    );
  }
  
  // Filter for only attended participants if the column exists
  let attendedData = results.data;
  if (attendedColumn) {
    const yesCount = attendedData.filter(row => String(row[attendedColumn]).toLowerCase() === "yes").length;
    console.log(`Found ${yesCount} rows with Attended = "Yes" out of ${attendedData.length} total rows`);
    
    if (yesCount > 0) {
      attendedData = attendedData.filter(row => String(row[attendedColumn]).toLowerCase() === "yes");
      console.log(`Filtered to ${attendedData.length} attended records`);
    } else {
      console.warn("No rows with Attended='Yes' found. Processing all rows instead.");
    }
  }
  
  // Process records
  const validRows: AttendeeRecord[] = [];
  const invalidRows: any[] = [];
  
  for (let i = 0; i < attendedData.length; i++) {
    const row = attendedData[i];
    
    // Skip rows with placeholder or empty values in the timestamp fields
    const joinTimeRaw = String(row[joinTimeColumn] || "").trim();
    const leaveTimeRaw = String(row[leaveTimeColumn] || "").trim();
    
    if (joinTimeRaw === "--" || leaveTimeRaw === "--" || !joinTimeRaw || !leaveTimeRaw) {
      console.log(`Row ${i+1}: Skipping due to placeholder or empty timestamps: Join="${joinTimeRaw}", Leave="${leaveTimeRaw}"`);
      continue;
    }
    
    try {
      // Parse the timestamps using the specific Zoom format
      // First try to parse timestamps in the format "03/29/2025 07:32:31 PM" (month/day/year)
      let joinTime: Date | null = null;
      let leaveTime: Date | null = null;
      
      // Handle different timestamp formats:
      // 1. MM/DD/YYYY HH:MM:SS AM/PM (e.g., "03/29/2025 07:32:31 PM")
      // 2. Month D, YYYY HH:MM:SS AM/PM (e.g., "Mar 29, 2025 07:32:31 PM")
      // 3. YYYY-MM-DD HH:MM:SS (e.g., "2025-03-29 19:32:31")
      
      // Try MM/DD/YYYY HH:MM:SS AM/PM format
      const dateRegex1 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})\s+(AM|PM)$/i;
      const joinMatch1 = joinTimeRaw.match(dateRegex1);
      const leaveMatch1 = leaveTimeRaw.match(dateRegex1);
      
      if (joinMatch1 && leaveMatch1) {
        // Parse join time: MM/DD/YYYY HH:MM:SS AM/PM
        const [_, joinMonth, joinDay, joinYear, joinHour, joinMinute, joinSecond, joinAmPm] = joinMatch1;
        let joinHour24 = parseInt(joinHour);
        if (joinAmPm.toLowerCase() === 'pm' && joinHour24 < 12) joinHour24 += 12;
        if (joinAmPm.toLowerCase() === 'am' && joinHour24 === 12) joinHour24 = 0;
        
        joinTime = new Date(
          parseInt(joinYear),
          parseInt(joinMonth) - 1,  // JavaScript months are 0-indexed
          parseInt(joinDay),
          joinHour24,
          parseInt(joinMinute),
          parseInt(joinSecond)
        );
        
        // Parse leave time: MM/DD/YYYY HH:MM:SS AM/PM
        const [__, leaveMonth, leaveDay, leaveYear, leaveHour, leaveMinute, leaveSecond, leaveAmPm] = leaveMatch1;
        let leaveHour24 = parseInt(leaveHour);
        if (leaveAmPm.toLowerCase() === 'pm' && leaveHour24 < 12) leaveHour24 += 12;
        if (leaveAmPm.toLowerCase() === 'am' && leaveHour24 === 12) leaveHour24 = 0;
        
        leaveTime = new Date(
          parseInt(leaveYear),
          parseInt(leaveMonth) - 1,  // JavaScript months are 0-indexed
          parseInt(leaveDay),
          leaveHour24,
          parseInt(leaveMinute),
          parseInt(leaveSecond)
        );
      } else {
        // Try Month D, YYYY HH:MM:SS AM/PM format
        const dateRegex2 = /^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})\s+(AM|PM)$/i;
        const joinMatch2 = joinTimeRaw.match(dateRegex2);
        const leaveMatch2 = leaveTimeRaw.match(dateRegex2);
        
        if (joinMatch2 && leaveMatch2) {
          // Map month abbreviations to month indices (0-based)
          const months: Record<string, number> = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
          };
          
          // Parse join time: Month D, YYYY HH:MM:SS AM/PM
          const [_, joinMonth, joinDay, joinYear, joinHour, joinMinute, joinSecond, joinAmPm] = joinMatch2;
          let joinHour24 = parseInt(joinHour);
          if (joinAmPm.toLowerCase() === 'pm' && joinHour24 < 12) joinHour24 += 12;
          if (joinAmPm.toLowerCase() === 'am' && joinHour24 === 12) joinHour24 = 0;
          
          joinTime = new Date(
            parseInt(joinYear),
            months[joinMonth.toLowerCase()],
            parseInt(joinDay),
            joinHour24,
            parseInt(joinMinute),
            parseInt(joinSecond)
          );
          
          // Parse leave time: Month D, YYYY HH:MM:SS AM/PM
          const [__, leaveMonth, leaveDay, leaveYear, leaveHour, leaveMinute, leaveSecond, leaveAmPm] = leaveMatch2;
          let leaveHour24 = parseInt(leaveHour);
          if (leaveAmPm.toLowerCase() === 'pm' && leaveHour24 < 12) leaveHour24 += 12;
          if (leaveAmPm.toLowerCase() === 'am' && leaveHour24 === 12) leaveHour24 = 0;
          
          leaveTime = new Date(
            parseInt(leaveYear),
            months[leaveMonth.toLowerCase()],
            parseInt(leaveDay),
            leaveHour24,
            parseInt(leaveMinute),
            parseInt(leaveSecond)
          );
        } else {
          // Fallback to native Date parsing
          const nativeJoinTime = new Date(joinTimeRaw);
          const nativeLeaveTime = new Date(leaveTimeRaw);
          
          if (!isNaN(nativeJoinTime.getTime()) && !isNaN(nativeLeaveTime.getTime())) {
            joinTime = nativeJoinTime;
            leaveTime = nativeLeaveTime;
          }
        }
      }
      
      // Validate timestamps
      if (!joinTime || isNaN(joinTime.getTime())) {
        console.warn(`Row ${i+1}: Invalid join time format: "${joinTimeRaw}"`);
        invalidRows.push(row);
        continue;
      }
      
      if (!leaveTime || isNaN(leaveTime.getTime())) {
        console.warn(`Row ${i+1}: Invalid leave time format: "${leaveTimeRaw}"`);
        invalidRows.push(row);
        continue;
      }
      
      // Check if leave time is after join time
      if (leaveTime.getTime() <= joinTime.getTime()) {
        console.warn(`Row ${i+1}: Leave time is not after join time. Join=${joinTimeRaw}, Leave=${leaveTimeRaw}`);
        invalidRows.push(row);
        continue;
      }
      
      // Extract duration if available
      let duration: number | undefined = undefined;
      if (durationColumn && row[durationColumn]) {
        const durationStr = String(row[durationColumn]).trim();
        if (durationStr && durationStr !== "--" && !isNaN(Number(durationStr))) {
          duration = Number(durationStr);
        }
      }
      
      // Create the valid record
      validRows.push({
        name: nameColumn ? String(row[nameColumn]).trim() : undefined,
        email: emailColumn ? String(row[emailColumn]).trim() : undefined,
        joinTime,
        leaveTime,
        duration,
        country: countryColumn ? String(row[countryColumn]).trim() : undefined,
        extraData: extraColumns.reduce((acc, colName) => {
          if (row[colName]) {
            acc[colName] = String(row[colName]).trim();
          }
          return acc;
        }, {} as Record<string, string>)
      });
      
      // Log successful parsing
      if (i === 0 || i === attendedData.length - 1) {
        console.log(`Row ${i+1}: Successfully parsed timestamps: ` +
          `Join=${joinTime.toISOString()}, Leave=${leaveTime.toISOString()}`);
      }
      
    } catch (error) {
      console.error(`Row ${i+1}: Error processing row:`, error);
      invalidRows.push(row);
    }
  }
  
  console.log(`Successfully processed ${validRows.length} valid rows, ${invalidRows.length} invalid rows`);
  
  if (validRows.length === 0) {
    // Get a sample of the data to help with debugging
    const headerInfo = headers.length > 0 ? `Found these headers: ${headers.join(", ")}` : "No headers found";
    const sampleRowInfo = attendedData.length > 0 ? 
      `Sample row data: ${JSON.stringify(attendedData[0], null, 2)}` : 
      "No data rows found";
    
    console.error("CSV parsing failed with detailed diagnostics:");
    console.error(headerInfo);
    console.error(sampleRowInfo);
    
    // Generate a more helpful error message
    throw new Error(
      "No valid attendance records found in the CSV file. This may be due to:\n" +
      "1. Missing required columns (needs Join Time, Leave Time, and Name)\n" +
      "2. Incorrect date/time format (should be like 'Mar 22, 2025 20:25:35')\n" +
      "3. Empty or corrupted file\n\n" +
      `${headerInfo}\n\n` +
      "Please check your CSV format and try again."
    );
  }
  
  return validRows;
};

/**
 * Calculate the total number of unique attendees.
 */
export const calculateTotalAttendees = (attendees: AttendeeRecord[]): number => {
  if (attendees.length === 0) return 0;

  // First try using email addresses if available
  const emailAttendees = attendees.filter((a) => a.email);
  if (emailAttendees.length > 0) {
    const uniqueEmails = new Set(emailAttendees.map((a) => a.email!.toLowerCase()));
    return uniqueEmails.size;
  }

  // Fall back to names if no emails
  const uniqueNames = new Set(attendees.map((a) => a.name.toLowerCase()));
  return uniqueNames.size;
};

// Simple test function for the preprocessZoomCsv functionality
// This is for development testing only and not used in production
const _testPreprocessZoomCsv = () => {
  const sampleZoomCsv = `Attendee Report,,,,,,,,,,,,,
Report Generated:,"Mar 23, 2025 6:26 PM",,,,,,,,,,,,
Topic,Webinar ID,Actual Start Time,Actual Duration (minutes),# Registered,# Cancelled,Unique Viewers,Total Users,Max Concurrent Views,Enable Registration,,,,
Freedom With AI Masterclass,847 5984 1045,"Mar 22, 2025 7:13 PM",282,3576,5,1805,3657,1034,Yes,,,,
Host Details,,,,,,,,,,,,,
Attended,User Name (Original Name),Email,Join Time,Leave Time,Time in Session (minutes),Is Guest,Country/Region Name,,,,,,
Yes,Avinash Mada,aavinash97@gmail.com,"Mar 22, 2025 19:13:27","Mar 22, 2025 23:55:19",282,No,India,,,,,,
Panelist Details,,,,,,,,,,,,,
Attended,User Name (Original Name),Email,Join Time,Leave Time,Time in Session (minutes),Is Guest,Country/Region Name,,,,,,
Yes,Kundan Sappa,skundanteja@gmail.com,"Mar 22, 2025 19:28:32","Mar 22, 2025 23:55:19",267,Yes,India,,,,,,
Yes,Kundan Sappa,skundanteja@gmail.com,"Mar 22, 2025 20:52:29","Mar 22, 2025 23:55:19",183,Yes,India,,,,,,
Yes,TusharAgarwal,tushar7003@gmail.com,"Mar 22, 2025 19:48:38","Mar 22, 2025 23:55:18",247,Yes,India,,,,,,
Attendee Details,,,,,,,,,,,,,
Attended,User Name (Original Name),First Name,Last Name,Email,Phone,Registration Time,Approval Status,Join Time,Leave Time,Time in Session (minutes),Is Guest,"Profession (if student mention ""Student"", not target profession)",Country/Region Name
No,Ajay,Ajay,FT 2,ajay@funnelstraffic.com,+919140328273,"Mar 15, 2025 11:23:29",approved,--,--,--,--,Ads,
No,VIKALP,VIKALP,SAXENA,vikalpsaxena2010@gmail.com,9936825237,"Mar 15, 2025 11:24:57",approved,--,--,--,--,Profession,
Yes,shuaib shaik,shuaib,shaik,shuaibshaik2789@gmail.com,+919010607160,"Mar 15, 2025 11:27:19",approved,"Mar 22, 2025 19:52:01","Mar 22, 2025 19:52:39",1,Yes,Ads,India`;

  console.log("===== TESTING ZOOM CSV PREPROCESSING =====");
  
  // Test the preprocessZoomCsv function
  const processedCsv = preprocessZoomCsv(sampleZoomCsv);
  
  console.log("Original CSV first few lines:");
  console.log(sampleZoomCsv.split("\n").slice(0, 5).join("\n"));
  
  console.log("\nProcessed CSV first few lines:");
  console.log(processedCsv.split("\n").slice(0, 5).join("\n"));
  
  console.log("\nProcessed CSV line count:", processedCsv.split("\n").length);
  console.log("===== END TEST =====");
};

// Uncomment to run the test
// _testPreprocessZoomCsv();
