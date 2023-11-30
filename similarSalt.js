const { Client } = require("pg");
const dotenv = require('dotenv')
dotenv.config({ path: './config.env' })


// const dbConfig = {
//     user: process.env.db_user,
//     host: process.env.db_host,
//     database: process.env.db_database,
//     password: process.env.db_pwd,
//     port: process.env.db_port,
// };

const dbConfig = {
    connectionString: process.env.DATABASE_URL, // Use your environment variable for the database URL
    ssl: {
      rejectUnauthorized: false, // For testing purposes. In production, provide a CA certificate.
      // ca: fs.readFileSync(path.join(__dirname, 'path/to/ca-certificate.pem')),
    },
  };

const saltSimilarity = (saltList1, saltList2) => {
    const totalSalts = saltList1.length;
    const matchingSalts = saltList1.filter(salt1 =>
        saltList2.nested_array.includes(salt1.name)
    ).length;

    if (totalSalts === 0) {
        return 0;
    }

    return (matchingSalts / totalSalts) * 100.0;
};

// Function to find the top 5 matches for a given patient
function findTopMatches(reportid) {
    const client = new Client(dbConfig);
    let patientSaltArray;

    return client.connect()
        .then(() => {
            const query = {
                text: 'SELECT name,patientid FROM medicines WHERE reportid = $1',
                values: [reportid],
            };
            return client.query(query);
        })
        .then(result => {
            patientSaltArray = result.rows;
            var patientid=1;
            if(patientSaltArray.length>0)
            patientid = patientSaltArray[0].patientid;

            const query = {
                text: 'SELECT reportid,patientid, ARRAY_AGG(name) AS nested_array FROM medicines GROUP BY reportid,patientid HAVING patientid <> $1;',
                values: [patientid]
            };
            return client.query(query);
        })
        .then(result => {
            const allPatients = result.rows;
            const seenIds = new Set();
            const uniqueTop5Results = [];

            const similarityResults = allPatients.map(patient => ({
                id: patient.patientid,
                similarity: saltSimilarity(patientSaltArray, patient),
            }));

            // Sort the results by similarity in descending order
            similarityResults.sort((a, b) => b.similarity - a.similarity);

            // Iterate through the sorted results and add unique entries to uniqueTop5Results
            for (const result of similarityResults) {
                if (!seenIds.has(result.id) && (result.similarity>0)) {
                    seenIds.add(result.id);
                    uniqueTop5Results.push(result);

                    // Break the loop when you have collected 5 unique results
                    // if (uniqueTop5Results.length === 5) {
                    //     break;
                    // }
                }
            }

            // Return the unique top 5 results
            return (uniqueTop5Results || []);


        })
        .catch(error => {
            console.error('Error:', error);
            throw error; // Propagate the error to the next catch block
        })
        .finally(() => {
            client.end();
        });
}

module.exports = findTopMatches;
