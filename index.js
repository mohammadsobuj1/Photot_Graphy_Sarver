const express = require('express');
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_KEY);
const port = process.env.PORT || 5000;


// meadile wear 
app.use(cors())
app.use(express.json())

// jwt meddle wear 

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.SECRT_ACCESS_TOKEN, (err, decoded) => {

        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1izglfl.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const userCollactions = client.db("assainmentDB").collection("users");
        const classCollactions = client.db("assainmentDB").collection("class");
        const selactedClassCollactions = client.db("assainmentDB").collection("selactedclass");
        const paymentCollactions = client.db("assainmentDB").collection("payments");




        // jwt api


        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.SECRT_ACCESS_TOKEN, { expiresIn: '1h' })

            res.send({ token })
        })

        // addmin vareify 

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollactions.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        // veryfy instractor 

        const verifyInstractor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollactions.findOne(query);
            if (user?.role !== 'instractor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }






        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await userCollactions.findOne(query);

            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }
            const result = await userCollactions.insertOne(user)
            res.send(result)
        })


        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await userCollactions.find().toArray();
            res.send(result)
        })

        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                return res.send({ admin: false })
            }

            const query = { email: email }
            const user = await userCollactions.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })



        app.delete("/deleteuser/:id", async (req, res) => {
            const id = req.params.id;
       
            const query = { _id: new ObjectId(id) };
            const result = await userCollactions.deleteOne(query);
            res.send(result);

        })



        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;


            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };

            const result = await userCollactions.updateOne(filter, updateDoc);
            res.send(result);

        })


        // cerat paymentMethod 

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })


        })
        // payment detailes 

        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;

            const insertResult = await paymentCollactions.insertOne(payment);
            res.send(insertResult);
            const paymentID = payment.class_id;

            if (paymentID) {
                const qurey = { _id: new ObjectId(paymentID) }
                const updateResult = await classCollactions.findOne(qurey)

                classCollactions.updateOne(
                    { _id: updateResult._id },
                    {
                        $inc: {
                            enrolled_student: 1,
                            seats: -1
                        }
                    }
                )

            }



        })



        // after payment delete api 

        app.delete('/selactedclass/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selactedClassCollactions.deleteOne(query);
            res.send(result);
        })




        // my enroll page api 


        app.get('/payments', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const qurey = { email: email }
            const result = await paymentCollactions.find(qurey).toArray()
            res.send(result)

        })






        // instractore page api 
        app.get('/allinstractor', async (req, res) => {
            const role = req.query.role;

            const filter = { role: role }
            const result = await userCollactions.find(filter).toArray()
            res.send(result)
        })



        app.get('/users/instractor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                return res.send({ instractor: false })
            }

            const query = { email: email }
            const user = await userCollactions.findOne(query);
            const result = { instractor: user?.role === 'instractor' }
            res.send(result);
        })



        // selacted selactedClassCollactions start 

        app.post('/selactedclass', async (req, res) => {
            const selactedClass = req.body;
            const result = await selactedClassCollactions.insertOne(selactedClass)
            res.send(result)
        })




        app.get('/selactedclass', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await selactedClassCollactions.find(query).toArray();

            res.send(result)
        })

        app.get('/selactedclass/:id', async (req, res) => {
            const id = req.params.id;
            const qurey = { _id: new ObjectId(id) }
            try {
                const result = await selactedClassCollactions.findOne(qurey);
                res.send(result)
            } catch (error) {
                res.send(error)
            }
        })

        app.delete('/selactedclass/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selactedClassCollactions.deleteOne(query);
            res.send(result);
        })


        // const x= obj.seats-1


        app.patch('/users/instractor/:id', async (req, res) => {
            const id = req.params.id;


            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instractor'
                },
            };

            const result = await userCollactions.updateOne(filter, updateDoc);
            res.send(result);

        })







        app.post('/class', verifyJWT, async (req, res) => {
            const user = req.body;
            const result = await classCollactions.insertOne(user)
            res.send(result)
        })




        app.get('/updateclass/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await classCollactions.findOne(filter)

            res.send(result)
        })



        // updat instractor single class 

        app.put("/update/:id", async (req, res) => {
            const id = req.params.id;
            const Updateduser = req.body;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updateToy = {
                $set: {
                    classname: Updateduser.classname,
                    image: Updateduser.image,
                    price: Updateduser.price,
                    seats: Updateduser.seats,

                },
            }
            try {
                const result = await classCollactions.updateOne(filter, updateToy, options)
                res.send(result)
            } catch (error) {
                res.send(error)
            }
        })



        // // total enroll class 
        // app.get('/enrollclass', async (req, res) => {
        //     const email = req.query.email

        //     const query = { instractorEmail: email }
        //     const result = await paymentCollactions.find(query).toArray();

        //     res.send(result)
        // })





        app.patch('/class/aprove/:id', async (req, res) => {
            const id = req.params.id;


            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {

                    status: 'aprove'
                },
            };

            const result = await classCollactions.updateOne(filter, updateDoc);
            res.send(result);

        })
        app.patch('/class/deny/:id', async (req, res) => {
            const id = req.params.id;


            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {

                    status: 'deny'
                },
            };

            const result = await classCollactions.updateOne(filter, updateDoc);
            res.send(result);

        })





        app.get('/adminclass', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await classCollactions.find().toArray();
            res.send(result)
        })



        app.get('/class', async (req, res) => {
            const status = req.query.status;
            const query = { status: status };
            const result = await classCollactions.find(query).toArray();
            res.send(result)
        })
        app.get('/class', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await paymentCollactions.find(query).toArray();
            res.send(result)
        })



        app.get('/class/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'porviden access' })
            }

            const query = { email: email };
            const result = await classCollactions.find(query).toArray();

            res.send(result)

        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('assainment 12 is start')
})

app.listen(port, () => {
    console.log('assainment 12 is running on port' + port)
})