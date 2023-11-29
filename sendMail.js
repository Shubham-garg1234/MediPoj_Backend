const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: "medipoj@gmail.com",
        pass: "vkva nfvi cwfa aqgx"
    }
});

function generate_OTP(email) {
    return new Promise(async (resolve, reject) => {
        let OTP = '';

        function generateOTP() {
            var digits = '0123456789';
            for (let i = 0; i < 4; i++) {
                OTP += digits[Math.floor(Math.random() * 10)];
            }
        }
        generateOTP();
            const info = transporter.sendMail({
                from: '"Fred Foo 👻" <>',
                to: email,
                subject: "Thanks for login",
                text: "",
                html: "<h4>Do not Share this OTP</h4><h3>Your OTP is <h1>" + OTP + "</h1></h3>",
            });
            info.then(()=>{console.log("OTP send Success"); resolve(OTP);})
            .catch(()=>{console.log("Error in sending OTP at module sendMail.js"); reject();});
        }
    );  
}

module.exports = generate_OTP;
