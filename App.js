const express = require("express");
const jwt = require('jsonwebtoken');
const app = express();
const cors = require("cors");
const http=require("http");
const bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(cors());
app.options("*", cors());
const { Client } = require("pg");
const generate_OTP = require("./sendMail");
const findTopMatches=require("./similarSalt");
const server=http.createServer(app);
const dotenv=require('dotenv')

dotenv.config({path:'./config.env'})

const io = require('socket.io')(server, {
  cors: {
    origin: '*',
  }
});

io.on('connection', (socket) => {
  socket.on('message_to_server', (message) => {
    io.emit('message_to_client', message);
  });
  socket.on('disconnect', () => {
  });
});




io.on('connection', (socket) => {

  // Assuming you have user IDs, you can handle it when a user connects
  socket.on('setUserId', (userId) => {
    socket.join(userId); // Join a room identified by the user ID
  });

  socket.on('sendneedyMessage', ({ toUserId, message }) => {
    // Send the message to the specific user
    io.to(toUserId).emit('receiveneedyMessage', { fromUserId: socket.id, message });
  });

  socket.on('sendhelperMessage', ({ toUserId, message }) => {
    // Send the message to the specific user
    io.to(toUserId).emit('receivehelperMessage', { fromUserId: socket.id, message });
  });

  socket.on('disconnect', () => {
  });
});






const dbConfig = {
  user: process.env.db_user,
  host: process.env.db_host,
  database: process.env.db_database,
  password: process.env.db_pwd,
  port: process.env.db_port,
};

// ----------->Check for login credentials  of patient

app.post("/loginpatient",(req,resp)=>{
  const email=req.body.email;
  const pwd=req.body.pwd;
  const client=new Client(dbConfig);

  client.connect().catch((err)=>{console.log("ERR :", err)})
  .then(()=>{
    const query={ 
      text:'Select * from verifiedpatient where email=$1;',
      values:[email]
    };
    return client.query(query);
  }).catch((err)=>{console.log("ERR :", err)})
  .then((data)=>{
    if(data.rows.length==0){
      resp.send('0');
    }
    else if(data.rows[0].pwd==pwd){
    const userId=data.rows[0].userid;
    const token = jwt.sign({ userId }, process.env.jwt_secret, { expiresIn: '10h' });
    resp.json({ token });
  }
    else{
    resp.send('0');
  }
  client.end();
  }).catch((err)=>{console.log(err)})
})

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  jwt.verify(token, process.env.jwt_secret, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Token verification failed' });
    }

    req.userId = decoded.userId;
    next();
  });
};


app.use('/protected', verifyToken);

app.get('/protected', (req, res) => {
  res.json({ message: 'Protected endpoint accessed successfully', userId: req.userId });
});


// ----------->Check for login credentials  of Docotor

app.post("/logindoctor",(req,resp)=>{
  const email=req.body.email;
  const pwd=req.body.pwd;
  const client=new Client(dbConfig);

  client.connect().catch((err)=>{console.log("ERR :", err)})
  .then(()=>{
    const query={ 
      text:'Select * from verifieddoctor where email=$1;',
      values:[email]
    };
    return client.query(query);
  }).catch((err)=>{console.log("ERR :", err)})
  .then((data)=>{
    if(data.rows.length==0){
      resp.send('0');
    }
    else if(data.rows[0].pwd==pwd){
    const userId=data.rows[0].userid;
    const token = jwt.sign({ userId }, process.env.jwt_secret, { expiresIn: '10h' });
    resp.json({ token });
  }
    else{
    resp.send('0');
  }
  client.end();
  }).catch((err)=>{console.log(err)})
})


// ----------->Check for login credentials  of merchant

app.post("/loginmerchant",(req,resp)=>{
  const email=req.body.email;
  const pwd=req.body.pwd;
  const client=new Client(dbConfig);

  client.connect().catch((err)=>{console.log("ERR :", err)})
  .then(()=>{
    const query={ 
      text:'Select * from verifiedmerchant where email=$1;',
      values:[email]
    };
    return client.query(query);
  }).catch((err)=>{console.log("ERR :", err)})
  .then((data)=>{
    if(data.rows.length==0){
      resp.send('0');
    }
    else if(data.rows[0].pwd==pwd){
    const userId=data.rows[0].userid;
    const token = jwt.sign({ userId }, process.env.jwt_secret, { expiresIn: '10h' });
    resp.json({ token });
  }
    else{
    resp.send('0');
  }
  client.end();
  }).catch((err)=>{console.log(err)})
})



// Make request for OTP

app.post("/making_reqOTP", (req, resp) => {
  const email = req.body.email;
  const userId = req.body.userId;
  const username = req.body.userName;

  // Check if the email already exists in any of the three tables
  const checkEmailQuery = {
    text: `
      SELECT COUNT(*) AS total_count
      FROM (
        SELECT email FROM verifiedpatient WHERE email = $1
        UNION ALL
        SELECT email FROM verifieddoctor WHERE email = $1
        UNION ALL
        SELECT email FROM verifiedmerchant WHERE email = $1
      ) AS combined_emails;
    `,
    values: [email],
  };

  const client = new Client(dbConfig);
  client
    .connect()
    .then(() => {
      return client.query(checkEmailQuery); // Execute the query to check if the email exists
    })
    .then((result) => {
      const emailExists = result.rows[0].total_count > 0;

      if (emailExists) {
        // If the email already exists, return '0'
        resp.send("0");
      } else {
        // If the email does not exist, generate and store the OTP
        const store_otp = generate_OTP(email);

        store_otp
          .then((otp) => {
            console.log(otp);

            const insertQuery = {
              text: 'INSERT INTO unverified VALUES ($1, $2, $3, $4);',
              values: [userId, email, otp, username],
            };

            return client.query(insertQuery); // Execute the query to insert the data
          })
          .then(() => {
            client.end(); // Close the database connection
            resp.send("2"); // Send the response
          })
          .catch((error) => {
            console.log( error);
            resp.status(500).send("Error");
          });
      }
    })
    .catch((error) => {
      console.log("Error checking email existence:", error);
      resp.status(500).send("Error");
    });
});



//Verify OTP

app.post("/verify_OTP", (req, resp) => {
  const userId = req.body.userId;
  const Otp = req.body.Otp;
  const client = new Client(dbConfig);
  client
    .connect()
    .then(() => {
      const query = {
        text: 'Select otp from unverified where userId=$1',
        values: [userId],
      };

      return client.query(query);
    })
    .then((result) => {
      client.end();
      const real_otp = result.rows[0].otp;
      if (real_otp == Otp) {
        resp.send(true);
      } else {
        resp.send(false);
      }
    })
    .catch((err) => console.log(err));
});


// Check that account exist or not

app.post("/Check_Account_existence",(req,res)=>{
  const client=new Client(dbConfig);
  const email=req.body.email;
  const userId=req.body.userId;
  client.connect()
  .then(()=>{
    const query = {
      text: `
        SELECT COUNT(*) AS total_count
        FROM (
          SELECT email FROM verifiedpatient WHERE email = $1
          UNION ALL
          SELECT email FROM verifieddoctor WHERE email = $1
          UNION ALL
          SELECT email FROM verifiedmerchant WHERE email = $1
        ) AS combined_emails;
      `,
      values: [email],
    };
    return client.query(query);
  })
  .then((result)=>{
    if(result.rows[0].total_count>0){
      const store_otp = generate_OTP(email);

        store_otp
          .then((otp) => {
            console.log(otp);
            
            const insertQuery = {
              text: 'INSERT INTO unverified (userid, email, otp) VALUES ($1, $2, $3);',
              values: [userId, email, otp],
            };

            return client.query(insertQuery); // Execute the query to insert the data
          })
          .then(() => {
            client.end(); // Close the database connection
            res.send("1"); // Send the response
          })
    }
    else{
    res.send('0')
    client.end();
  }
  })
})
// Get Details of User patient

app.post("/getdetails",(req,resp)=>{
  const userId=req.body.userId;
  const client = new Client(dbConfig);
  client
    .connect()
    .then(() => {
      const query = {
        text: 'Select email,username from verifiedpatient where userid=$1;',
        values: [userId]
      };
      return client.query(query);
    })
    .catch((err)=>{console.log("ERROR:",err)})
    .then((result) => {
      client.end(); // Close the database connection
      resp.send(result.rows[0]);
    })
    .catch((err) =>{console.log(err); resp.send(false)});
})



// Get details of Doctor


app.post("/getdetailsDoctor",(req,resp)=>{
  const userId=req.body.userId;
  const client = new Client(dbConfig);
  client
    .connect()
    .then(() => {
      const query = {
        text: 'Select email,dp_url,username,registration,qualification,exp,fees,start,"end" from verifieddoctor where userid=$1;',
        values: [userId]
      };
      return client.query(query);
    })
    .catch((err)=>{console.log("ERROR:",err)})
    .then((result) => {
      client.end(); // Close the database connection
      resp.send(result.rows[0]);
    })
    .catch((err) =>{console.log(err); resp.send(false)});
})


// Update Doctor 

app.post("/updateDoctor",(req,resp)=>{
  const qual=req.body.qual;
  const fee=req.body.fee;
  const end='00:00:00';
  const start='00:00:00';
  const exp=req.body.exp;
  const userId=req.body.userId;
  const client = new Client(dbConfig);
  client
    .connect()
    .then(() => {
      const query = {
        text: 'update verifiedDoctor set qualification=$1, exp=$2, start=$3, "end"=$4, fees=$5 Where userid=$6',
        values: [qual,exp,start,end,fee,userId]
      };
      return client.query(query);
    })
    .catch(()=>{resp.send("0")})
    .then((result) => { 
      client.end();
      resp.send("1");
    })
    .catch((err) =>{console.log(err); resp.send(false)});
})

app.post("/uploaddp",(req,resp)=>{
  const imageurl=req.body.url;
  const userId=req.body.userId;
  const client = new Client(dbConfig);
  client
    .connect()
    .then(() => {
      const query = {
        text: 'update verifiedDoctor set  dp_url=$1 Where userid=$2',
        values: [imageurl,userId]
      };
      return client.query(query);
    })
    .catch(()=>{resp.send("0")})
    .then((result) => {
      client.end();
      resp.send("1");
    })
    .catch((err) =>{console.log(err); resp.send(false)});
})


// Adding Slot in Doctor's id

app.post("/addslot",(req,resp)=>{
  const end=req.body.etime;
  const start=req.body.stime;
  const userId=req.body.userId;
  const client = new Client(dbConfig);
  client
    .connect()
    .then(() => {
      const query = {
        text: 'Insert into slot values($1, $2, $3 ,$4)',
        values: [userId,0,start,end]
      };
      return client.query(query);
    })
    .catch(()=>{resp.send("0")})
    .then((result) => { 
      client.end();
      resp.send("1");
    })
    .catch(() =>{console.log("Error in disconnecting"); resp.send(false)});
})

app.post("/getavlslot",(req,resp)=>{
  const userId=req.body.userId;
  const client = new Client(dbConfig);
  client
    .connect()
    .then(() => {
      const query = {
        text: 'select stime,etime,id,status from slot where doctorid=$1;',
        values: [userId]
      };
      return client.query(query);
    })
    .then((result) => { 
      client.end();
      resp.send(result.rows);
    })
    .catch((err) =>{console.log(err); resp.send(false)});
})

//------------> Deleting slot 

app.post("/deleteslot",(req,resp)=>{
  const id=req.body.id;
  const client = new Client(dbConfig);
  client
    .connect()
    .then(() => {
      const query = {
        text: 'DELETE FROM slot WHERE id = $1 ;',
        values: [id]
      };
      return client.query(query);
    })
    .then((result) => { 
      client.end();
      resp.send('1');
    })
    .catch((err) =>{console.log(err); resp.send(false)});
})



// Making Password

app.post("/setpwd",(req,resp)=>{
  const userId=req.body.userId;
  const pwd=req.body.pwd;
  const email=req.body.email;
  const type=req.body.type;
  const username=req.body.userName;

  const client = new Client(dbConfig);
  client
    .connect()
    .then(()=>{
      const deleteQuery = {
        text: 'DELETE FROM unverified WHERE userid = $1',
        values: [userId]
      };
      return client.query(deleteQuery);
    })
    .catch((err)=>{console.log("ERROR:",err)})
    .then((garg) => {
      if(type=="P"){
      const query = {
        text: 'Insert into verifiedpatient values($1,$2,$3,$4);',
        values: [userId,username,pwd,email]
      };
      
      return client.query(query);
    }
      if(type=="D"){
        const registration=req.body.registration;
        const query = {
          text: 'Insert into verifieddoctor values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10);',
          values: [userId,username,pwd,email,registration,0,0,'','00:00','00:00']
        };
        return client.query(query);
      }
        if(type=="M"){
          const query = {
            text: 'Insert into verifiedmerchant values($1,$2,$3,$4);',
            values: [userId,username,pwd,email]
          };
          return client.query(query);
        }
    })
    .catch((err)=>{console.log("ERROR:",err)})
    .then((result) => {
      client.end(); // Close the database connection
      console.log("Database disconnected");
      resp.send(true);
    })
    .catch(() => {console.log("Error in disconnecting"); resp.send(false)});
});



// Update password

app.post("/update_pwd", (req, resp) => {
  const userId = req.body.userId;
  const pwd = req.body.pwd;
  const email = req.body.email;

  const client = new Client(dbConfig);

  client
    .connect()
    .then(() => {
      // Check email count in verifiedpatient
      const patientQuery = {
        text: 'SELECT COUNT(*) FROM verifiedpatient WHERE email = $1',
        values: [email]
      };

      return client.query(patientQuery);
    })
    .then((patientResult) => {
      const patientCount = patientResult.rows[0].count;
      
      // Check email count in verifieddoctor
      const doctorQuery = {
        text: 'SELECT COUNT(*) FROM verifieddoctor WHERE email = $1',
        values: [email]
      };

      return client.query(doctorQuery).then((doctorResult) => ({
        patientCount,
        doctorCount: doctorResult.rows[0].count
      }));
    })
    .then(({ patientCount, doctorCount }) => {
      let type = '';
      
      if (patientCount >= 1) {
        type = 'P';
      } else if (doctorCount >= 1) {
        type = 'D';
      } else {
        type = 'M';
      }

      const deleteQuery = {
        text: 'DELETE FROM unverified WHERE userid = $1',
        values: [userId]
      };

      return client.query(deleteQuery).then(() => type);
    })
    .then((type) => {
      const updateQuery = {
        text: type === 'P'
          ? 'UPDATE verifiedpatient SET pwd = $1 WHERE email = $2'
          : (type === 'D'
              ? 'UPDATE verifieddoctor SET pwd = $1 WHERE email = $2'
              : 'UPDATE verifieddoctor SET pwd = $1 WHERE email = $2'),
        values: [pwd, email]
      };

      return client.query(updateQuery).then(() => type);
    })
    .then((type) => {
      client.end(); // Close the database connection
      resp.send(true);
    })
    .catch((err) => {
      console.log("ERROR:", err);
      resp.send(false);
    });
});




// Get the loat of Doctors


app.get("/listofdoctors", (req, res) => {
  const client = new Client(dbConfig);
  client.connect()
    .then(() => {
      const query = {
        text: 'SELECT username, userid,dp_url FROM verifieddoctor;',
      };
      return client.query(query);
    })
    .then((data) => {
      const result = JSON.stringify(data.rows);
       res.send(result);
    })
    .catch((error) => {
      console.error("Error:", error);
      res.status(500).send("Internal Server Error");
    })
    .finally(() => {
      client.end(); // Close the database connection when done
      console.log("Database query complete");
    });
});

// Data of particular Doctor --------->

app.post("/detailfordoctor",(req,resp)=>{
  const client = new Client(dbConfig);
  const userid=req.body.userId;
  client
    .connect()
    .then(() => {
      const query = {
        text: 'select registration,fees,qualification,exp,dp_url,email from verifieddoctor where userid=$1',
        values: [userid]
      };
      return client.query(query);
    })
    .catch((err)=>{console.log(err)})
    .then((result) => { 
      return result.rows[0]
    }).then((data)=>{
      resp.send(data);
      client.end();
    })
    .catch(() =>{console.log("Error in disconnecting"); resp.send(false)});
})

app.get("/getAppData",(req, res) => {
  res.send({
    Appid: process.env.Appid,
    Appcertificate:process.env.Appcertificate,
  });
});

app.post("/update_slot_status",(req,res)=>{
  const slotid=req.body.selectedslot;
  const client=new Client(dbConfig);
  client.connect()
  .then(()=>{
    const query={
      text:'Update slot set status=$1 where id=$2;',
      values:[true,slotid]
    }
    return client.query(query);
  }).catch((err)=>(console.log(err)))
  .then(()=>(client.end()))
})
app.post("/sending_meeting_info", async (req, res) => {
  const client = new Client(dbConfig);
  const doctorid = req.body.doctorpageid;
  const userid = req.body.userId;
  const token = req.body.token1;
  const stime=req.body.stime;
  const etime=req.body.etime;
  const doctorname=req.body.doctorpagename;
  const date=new Date().toLocaleDateString();

  try {
    await client.connect();
    
    const query = {
      text: 'INSERT INTO meetings VALUES ($1, $2, $3, $4, $5, $6,TO_DATE($7, \'DD/MM/YYYY\'));',
      values: [doctorid, userid,token, stime, etime,doctorname,date],
    };

    await client.query(query);

    res.send('1');
  } catch (err) {
    console.error(err);
    res.send(false);
  } finally {
    client.end();
  }
});

app.get("/message_group",(req,res)=>{
  const client = new Client(dbConfig);
  client
    .connect()
    .then(() => {
      const query = {
        text: 'select text,samay from group_message'
      };
      return client.query(query);
    })
    .catch((err)=>{console.log(err)})
    .then((data) => {
      const result = JSON.stringify(data.rows);
      res.send(data.rows);
      client.end();
    })
    .catch(() =>{console.log("Error in disconnecting"); res.send(false)});
})

app.post('/update_group_message',(req,res)=>{
  const client = new Client(dbConfig);
  const message=req.body.group_message_data;
  const samay=req.body.samay;
  client
    .connect()
    .then(() => {
      const query = {
        text: 'Insert into group_message (text,samay) values ($1,$2);',
        values: [message,samay]
      };
      return client.query(query);
    })  
    .catch(() =>{console.log("Error in disconnecting"); res.send(false)})
    .then(() => {
      client.end();
      res.send('1');
    })
})

app.post('/notification',(req,res)=>{
  const client = new Client(dbConfig);
  const userid=req.body.userId;
  client
    .connect()
    .then(() => {
      const query = {
        text: 'select * from notification where userid=$1',
        values: [userid]
      };
      return client.query(query);
    })  
    .catch(() =>{console.log("Error in disconnecting"); res.send(false)})
    .then((data) => {
      res.send(data.rows);
      client.end();
    })
})

app.post("/GetMeetings",(req,res)=>{
  const id=req.body.userId;
  const client = new Client(dbConfig);
  client
    .connect()
    .then(() => {
      const query = {
        text: 'SELECT doctorid,doctorname, userid, token, stime, etime, to_char(tarikh, \'YYYY-MM-DD\') AS DateString FROM meetings WHERE doctorid = $1 OR userid = $2',
        values: [id,id]
      };            
      return client.query(query);
    })  
    .catch((err) =>{console.log(err); res.send(false)})
    .then((data) => {
      res.send(data.rows);
      client.end();
    })
})

app.post("/fetch_report",(req,res)=>{
  const userId=req.body.userId;
  const client = new Client(dbConfig);
  client.connect().catch((err)=>{console.log(err)})
  .then(()=>{
    const query={text:'Select reportid,reportdate,symptoms,diagnosis,recommendations,doctorname,doctorregistration from Reports where patientid=$1 ;', values:[userId]}
    return client.query(query);
  }).catch((err)=>{console.log(err)})
  .then((data)=>{
    client.end();
    res.send(data.rows);
  })
})

app.post("/fetch_medicine",(req,res)=>{
  const reportid=req.body.reportid;
  const client = new Client(dbConfig);
  client.connect().catch((err)=>{console.log(err)})
  .then(()=>{
    const query={text:'Select name, dose, duration from medicines where reportid=$1 ;', values:[reportid]}
    return client.query(query);
  }).catch((err)=>{console.log(err)})
  .then((data)=>{
    client.end();
    res.send(data.rows);
  })
})
app.post("/Uploadreport",(req,res)=>{
  const doctorid=req.body.userId;
  const patientid=req.body.report_patientid;
  // const date=req.body.date;
  const date=new Date().toLocaleDateString();
  const Medicines=req.body.Medicines;
  const Symptoms=req.body.Symptoms;
  const Diagnosis=req.body.Diagnosis;
  const Recommendations=req.body.Recommendations;
  const doctorname=req.body.userName;
  const registration=req.body.registration;
  let reportid;

  const client = new Client(dbConfig);
  client.connect().catch((err)=>{console.log(err)})
  .then(()=>{
    const query={text:'Insert into Reports (patientid, doctorid, reportdate, symptoms, diagnosis, recommendations, doctorname, doctorregistration) values ($1,$2,TO_DATE($3, \'DD/MM/YYYY\'),$4,$5,$6,$7,$8) RETURNING reportid;',
     values:[patientid,doctorid,date,Symptoms,Diagnosis,Recommendations,doctorname,registration]}
    return client.query(query); 
  }).catch((err)=>{console.log(err)})
  .then((data)=>{ 
    reportid=data.rows[0].reportid;})
    .then(()=>{
      Medicines.map((data)=>{
    const query={text:'Insert into medicines (name, dose, duration,reportid,patientid) values ($1,$2,$3,$4,$5);',
     values:[data.m_name,data.dose,data.duration,reportid,patientid]}
    client.query(query); 
    })
  }).catch((err)=>{console.log(err)})
  .then(()=>{
    res.send('1');})
})

app.post("/Findmatches",(req,res)=>{
  const reportid=req.body.reportid;
  findTopMatches(reportid)
  .catch((err)=>console.log(err))
  .then((result)=>{
    res.send(result);
  })
})

app.post("/Anonymus_chat",(req,res)=>{
  const neederid=req.body.userId;
  const helperid=req.body.anonyid;
  const client = new Client(dbConfig);
  client.connect().catch((err)=>{console.log(err)})
  .then(()=>{
    const query={text:'Select text,samay,sender,tarikh from anonymus_chat where neederid=$1 AND helperid=$2 ;', values:[neederid,helperid]}
    return client.query(query);
  }).catch((err)=>{console.log(err)})
  .then((data)=>{
    client.end();
    res.send(data.rows);
  })
})

app.post("/Update_Anonymus_chat_neederside",(req,res)=>{
  const neederid=req.body.userId;
  const helperid=req.body.anonymusid;
  const date=req.body.date;
  const time=req.body.time;
  const text=req.body.text;
  const sender='sender';

  const client = new Client(dbConfig);
  client.connect().catch((err)=>{console.log(err)})
  .then(()=>{
    const query={text:'Insert into anonymus_chat (text,samay,tarikh,sender,neederid,helperid) values($1,$2,TO_DATE($3, \'MM/DD/YYYY\'),$4,$5,$6) ;', values:[text,time,date,sender,neederid,helperid]}
    return client.query(query);
  }).catch((err)=>{console.log(err)})
  .then(()=>{
    client.end();
  })
})

app.post("/Update_Anonymus_chat_helperside",(req,res)=>{
  const helperid=req.body.userId;
  const neederid=req.body.neederid;
  const date=req.body.date;
  const time=req.body.time;
  const text=req.body.text;
  const sender='receiver';
  const client = new Client(dbConfig);
  client.connect().catch((err)=>{console.log(err)})
  .then(()=>{
    const query={text:'Insert into anonymus_chat (text,samay,tarikh,sender,neederid,helperid) values($1,$2,TO_DATE($3, \'MM/DD/YYYY\'),$4,$5,$6) ;', values:[text,time,date,sender,neederid,helperid]}
    return client.query(query);
  }).catch((err)=>{console.log(err)})
  .then(()=>{
    client.end();
  })
})

app.post("/Find_needy_people",(req,res)=>{
  const helperid=req.body.userId;
  const client = new Client(dbConfig);
  client.connect().catch((err)=>{console.log(err)})
  .then(()=>{
    const query={text:'Select DISTINCT neederid from anonymus_chat where helperid=$1 ;', values:[helperid]}
    return client.query(query);
  }).catch((err)=>{console.log(err)})
  .then((data)=>{
    client.end();
    res.send(data.rows);
  })
})

app.post("/Find_chat_of_needy_people",(req,res)=>{
  const neederid=req.body.neederid;
  const helperid=req.body.userId;
  const client = new Client(dbConfig);
  client.connect().catch((err)=>{console.log(err)})
  .then(()=>{
    const query={text:'Select text,samay,sender,tarikh from anonymus_chat where neederid=$1 AND helperid=$2 ;', values:[neederid,helperid]}
    return client.query(query);
  }).catch((err)=>{console.log(err)})
  .then((data)=>{
    client.end();
    res.send(data.rows);
  })
})

app.get("/", function (req, res) {
  res.send("Server is running");
});

server.listen(process.env.PORT||3000, function () {
  console.log("Server is running on port 3000");
});