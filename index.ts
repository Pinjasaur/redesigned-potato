import express, { Request, Response } from 'express'
import { DataTypes, Model, QueryTypes, Sequelize } from 'sequelize';
import Sqids from 'sqids';

const app = express()
const PORT = process.env.PORT || 3000

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './db.sqlite'
});

const sqids = new Sqids({
  alphabet: '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ',
})

class Url extends Model {
  declare id: number
  declare url: string
}
Url.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, { sequelize, modelName: 'url' })

class Req extends Model {
  declare id: number
}
Req.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  }
}, { sequelize, modelName: 'req' })

Url.hasMany(Req)
Req.belongsTo(Url)

sequelize.sync()

const getUrlStats = async (id: number) => {
  // Raw queries a bit easier to wrangle vs trying to leverage the ORM
  try {
    const daily = await sequelize.query(`select * from reqs where urlId = ? and createdAt >= datetime('now','-24 hours')`, { replacements: [id], type: QueryTypes.SELECT })
    const weekly = await sequelize.query(`select * from reqs where urlId = ? and createdAt >= datetime('now','-7 days')`, { replacements: [id], type: QueryTypes.SELECT })
    const forever = await sequelize.query(`select * from reqs where urlId = ?`, { replacements: [id], type: QueryTypes.SELECT })
    return { daily: daily.length ?? 0, weekly: weekly.length ?? 0, forever: forever.length ?? 0 }

  } catch {
    return "Error getting stats"
  }
}

app.get('/__create__', async (req: Request, res: Response) => {
  if (!req.query.url)
    return res.status(400).send(`URL query parameter required`)

  try {
    const url = await Url.create({ url: req.query.url })
    const slug = sqids.encode([url.id])
    return res.status(201).send(`Created new short URL: ${slug}`)

  } catch {
    return res.status(400).send()
  }
})

app.get('/:slug', async (req: Request, res: Response) => {
  try {
    const url = await Url.findByPk(sqids.decode(req.params.slug)[0])
    if (!url)
      return res.status(404).send("Not found")

    if (req.query.debug)
      return res.json({ ...url.dataValues, slug: sqids.encode([url.id]) })

    if (req.query.stats) {
      const stats = await getUrlStats(url.id)
      return res.json(stats)
    }

    await Req.create({ urlId: url.id })
    return res.redirect(url.url)

  } catch {
    return res.status(404).send()
  }
})

app.get('/*', (req: Request, res: Response) => {
  return res.status(404).send("Not found")
})

app.listen(PORT, () => {
  console.log(`Running: http://localhost:${PORT}`)
})
