/**
 * Curated word lists for the offline lesson generator (SPEC §6). Isomorphic
 * data, but large: import it from server code, not from client islands.
 *
 * TIER2: useful academic ("tier-2") words that students meet across subjects,
 * each with a kid-friendly definition for ages 12–15 and an everyday example
 * sentence. British spelling; US variants are listed after the example.
 * Format per line: word|part of speech|definition|example[|variant,variant]
 *
 * COMMON_LONG_WORDS: frequent words of seven or more letters, so the generator
 * can tell a long but everyday word ("something") from a long, less common one
 * worth teaching.
 */

export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition';

export interface WordListEntry {
  word: string;
  partOfSpeech: PartOfSpeech;
  definition: string;
  example: string;
  /** Other accepted spellings (usually American). */
  variants: readonly string[];
}

const TIER2_TABLE = `
abandon|verb|to leave something behind for good|The hikers had to abandon their plan when thick fog covered the trail.
abundant|adjective|existing in large amounts; more than enough|Apples are abundant in autumn, so the market sells them cheaply.
access|noun|the chance or right to use or reach something|Everyone in the school has access to the library at lunchtime.
accomplish|verb|to succeed in finishing something|We accomplished a lot during our first rehearsal.
accurate|adjective|correct in every detail|Check that your notes are accurate before you revise from them.
achieve|verb|to succeed in doing something after working hard|She practised every day to achieve her goal of learning the song by heart.
acknowledge|verb|to accept or admit that something is true|He acknowledged that his team could have passed the ball more.
acquire|verb|to get or gain something|Over the summer I acquired a taste for spicy food.
adapt|verb|to change to suit a new situation|Our class had to adapt quickly when the trip moved indoors.
adequate|adjective|good enough for what is needed|The tent was small but adequate for two people.
adjust|verb|to change something slightly so it works better|She adjusted the seat so she could reach the pedals.
admire|verb|to respect and look up to someone or something|I admire how my cousin stays calm before exams.
advantage|noun|something that helps you do better than others|Being tall is an advantage when you play basketball.
advocate|verb|to speak up in support of an idea or group|Students advocated for more bike racks at school.
affect|verb|to change or influence something|Not getting enough sleep can affect how well you concentrate.
alternative|noun|another choice you could make instead|If the bus is late, walking is a good alternative.
ambitious|adjective|wanting to do something difficult or impressive|Building a robot in one week was an ambitious plan.
analyse|verb|to study something closely to understand how it works|We analysed the graph to see when the most people visited.|analyze
ancient|adjective|very old; from a time long ago|The museum displays ancient coins found near the river.
anticipate|verb|to expect something and get ready for it|The café anticipated a busy weekend and baked extra bread.
anxious|adjective|worried or nervous about what might happen|He felt anxious before his first swimming race.
apparent|adjective|easy to see or understand|It was apparent from her smile that the plan had worked.
appreciate|verb|to understand how good or important something is|I appreciate it when friends save me a seat.
approach|noun|a way of dealing with a problem or task|Her approach to learning lines was to record them and listen on the bus.
appropriate|adjective|right or suitable for a situation|Trainers are appropriate shoes for the sports hall.
approximately|adverb|close to an exact number but not exactly|The walk to school takes approximately fifteen minutes.
arrange|verb|to put things in a certain order, or to plan something|We arranged the chairs in a circle for the discussion.
aspect|noun|one part or feature of something|The best aspect of the trip was the boat ride.
aspire|verb|to hope and work to achieve something|She aspires to design her own video game one day.
assemble|verb|to put the parts of something together|It took us an hour to assemble the new bookshelf.
assess|verb|to judge how good or important something is|The coach assessed each player's speed during training.
assign|verb|to give someone a job or task|Our teacher assigned each group a different planet.
assist|verb|to help someone do something|Older students assist the younger ones on sports day.
assume|verb|to believe something is true without checking|I assumed the shop was open, but it had closed early.
astonish|verb|to surprise someone very much|The magician's final trick astonished the whole audience.
attempt|noun|a try at doing something difficult|On her third attempt, she finally landed the jump.
attitude|noun|the way you think and feel about something|His positive attitude made the long rehearsal more fun.
attract|verb|to make someone want to come closer or take part|The new climbing wall attracted lots of visitors.
audience|noun|the people who watch, read or listen to something|The audience clapped along to the last song.
authentic|adjective|real and true, not a copy|The chef used an authentic family recipe for the soup.
authority|noun|the power or right to make decisions|The referee has the authority to stop the match.
available|adjective|ready to be used or bought|Tickets for the school play are available at reception.
aware|adjective|knowing that something exists or is happening|Be aware that the path gets slippery after rain.
barrier|noun|something that blocks the way or makes progress hard|Not knowing the language was a barrier at first, but she kept practising.
benefit|noun|a good result or advantage|One benefit of walking to school is the fresh air.
bias|noun|an unfair preference for or against someone or something|A good referee tries to judge without bias.
bold|adjective|brave and confident; also, strong and easy to notice|The poster used bold colours so people would stop and look.
boundary|noun|a line or limit that marks the edge of something|The river forms the boundary between the two towns.
brief|adjective|lasting only a short time|After a brief break, the band played again.
brilliant|adjective|very clever, or very bright|She had a brilliant idea for the class project.
broadcast|verb|to send out a programme on television, radio or online|The final will be broadcast live on Saturday.
capable|adjective|having the skill or power to do something|He is capable of running the whole race without stopping.
capacity|noun|the most that something can hold|The stadium has a capacity of forty thousand people.
capture|verb|to catch or record something|The photo captures the moment the ball hit the net.
category|noun|a group of things that are alike in some way|Sort the books into categories such as mystery and history.
cautious|adjective|careful to avoid danger or mistakes|Be cautious when crossing the busy road.
celebrate|verb|to do something enjoyable because of a special event|We celebrated the end of exams with a picnic.
challenge|noun|something difficult that tests your skill|Learning to juggle was a fun challenge.
characteristic|noun|a typical quality or feature|Curiosity is a characteristic of good scientists.
chronological|adjective|arranged in the order that things happened|Put the photos in chronological order, from oldest to newest.
circumstance|noun|a fact or condition that affects what happens|Under normal circumstances, the bus arrives on time.
cite|verb|to mention something as proof or as an example|In your essay, cite two facts from the article.
clarify|verb|to make something easier to understand|Could you clarify what you meant by that?
collaborate|verb|to work together with others|The two classes collaborated on a mural for the hall.
collapse|verb|to fall down suddenly, or to fail|The sandcastle collapsed when the wave reached it.
colleague|noun|a person you work with|My aunt went to lunch with her colleagues from the hospital.
commemorate|verb|to do something to remember an important person or event|The town planted a tree to commemorate its 500th birthday.
commit|verb|to promise to give your time or effort to something|She committed to training twice a week.
communicate|verb|to share information or feelings with others|We communicate with our pen pals by email.
community|noun|a group of people who live in the same area or share something|The whole community helped clean up the park.
compare|verb|to look at how things are alike and different|Compare the two maps and find what changed.
compete|verb|to take part in a contest and try to win|Twelve teams will compete in the tournament.
competent|adjective|able to do something well enough|After a few lessons, he became a competent swimmer.
complex|adjective|having many parts and hard to understand|The instructions for the game were too complex for my little brother.
component|noun|one of the parts that make up something|A battery is an important component of a phone.
comprehend|verb|to understand something fully|It took me a while to comprehend the rules of cricket.
conceal|verb|to hide something|She concealed the gift behind her back.
concentrate|verb|to give all your attention to something|It is hard to concentrate when the TV is on.
concept|noun|an idea about how something works|The concept of gravity explains why things fall.
conclude|verb|to decide something after thinking about the facts|From the muddy footprints, we concluded that the dog had been outside.
conduct|verb|to organise and carry out something|The class conducted a survey about favourite lunches.
confident|adjective|feeling sure about yourself or your abilities|After practising, she felt confident about her speech.
conflict|noun|a serious disagreement between people or groups|The two friends solved their conflict by talking it through.
consequence|noun|a result of an action|One consequence of staying up late is feeling tired the next day.
conserve|verb|to protect something from being wasted or lost|Turn off lights to conserve energy.
considerable|adjective|large in size or amount|The new bridge will save a considerable amount of time.
consist|verb|to be made up of certain parts|The meal consisted of soup, bread and fruit.
consistent|adjective|always behaving or happening in the same way|Consistent practice is the best way to improve.
constant|adjective|happening all the time|The constant noise from the road made it hard to sleep.
construct|verb|to build something|Volunteers constructed a new playground in two days.
consult|verb|to ask someone or check something for advice or information|Consult a map before you set off.
contemporary|adjective|belonging to the present time; modern|The gallery shows contemporary art made in the last few years.
context|noun|the situation or words around something that help explain it|Use the context of the sentence to guess what the word means.
contribute|verb|to give something to help a group or cause|Everyone contributed a dish to the class party.
controversial|adjective|causing strong disagreement|The new school rule was controversial, and students debated it for weeks.
convert|verb|to change something into a different form|The old factory was converted into flats.
convince|verb|to make someone believe or agree with something|She convinced her parents to let her join the drama club.
cooperate|verb|to work together towards the same goal|The players cooperated to set up the tents.
coordinate|verb|to organise people or things so they work well together|Our teacher coordinated the trip with the museum staff.
crucial|adjective|extremely important|Warming up is crucial before a long run.
curious|adjective|eager to know or learn about something|The curious kitten sniffed every box in the room.
cycle|noun|a set of events that repeat in the same order|The water cycle includes rain, rivers and clouds.
debate|noun|a discussion where people share different views|Our class held a debate about school uniforms.
decade|noun|a period of ten years|The shop has been on this street for over a decade.
decline|verb|to become smaller or weaker|The number of visitors declined during the winter.
dedicate|verb|to give a lot of time and energy to something|He dedicated his weekends to learning the guitar.
defeat|noun|a loss in a game or contest|After the defeat, the team talked about what to try next time.
define|verb|to explain exactly what something means|Can you define the word "habitat"?
demonstrate|verb|to show how something works or that something is true|The chef demonstrated how to fold the dumplings.
depict|verb|to show something in a picture or in words|The painting depicts a busy market.
derive|verb|to get something from a particular source|Many English words are derived from Latin.
describe|verb|to say what something or someone is like|Describe your favourite place in three sentences.
design|noun|a plan or drawing that shows how something will look or work|Her design for the school logo won the contest.
despite|preposition|even though something else is true|Despite the rain, the match went ahead.
detail|noun|a small fact or feature|The story includes lots of details about the old house.
detect|verb|to notice or discover something that is hard to see|Some dogs can detect sounds that people cannot hear.
determination|noun|the quality of not giving up|With determination, she finished the race even with a sore ankle.
determine|verb|to find out or decide something|A coin toss determined which team kicked off.
develop|verb|to grow or change over time, or to create something new|The team developed a new app for sharing recipes.
devote|verb|to give your time or energy to something|She devotes an hour every evening to reading.
dialogue|noun|the words characters say to each other in a story or play|The dialogue in the play made the audience laugh.|dialog
diminish|verb|to become smaller or less|The noise diminished as the train moved away.
disappoint|verb|to make someone sad because something was not as good as hoped|The cancelled trip disappointed the whole class.
discover|verb|to find something for the first time|The children discovered a nest in the hedge.
display|verb|to show something so people can see it|The library displays students' art near the entrance.
distinct|adjective|clearly different or easy to notice|Each instrument has a distinct sound.
distinguish|verb|to see or show the difference between things|Can you distinguish the twins from each other?
distribute|verb|to give or share things out among people|Volunteers distributed water to the runners.
diverse|adjective|made up of many different kinds|The city has a diverse mix of food from around the world.
document|verb|to record information about something|The class documented the plants growing in the school garden.
dominate|verb|to control something or be the most important part of it|Tall buildings dominate the city skyline.
dramatic|adjective|sudden and exciting, or very noticeable|There was a dramatic change in the weather.
durable|adjective|able to last a long time without breaking|These durable boots have lasted three winters.
eager|adjective|wanting very much to do something|The eager students arrived early for the trip.
economy|noun|the way a country or area makes and uses money, goods and services|Tourism is important to the island's economy.
effective|adjective|working well and producing the result you want|Flashcards are an effective way to learn new words.
efficient|adjective|working well without wasting time or energy|The new bus route is more efficient.
elaborate|adjective|detailed and carefully planned|They built an elaborate model of the solar system.
element|noun|a basic part of something|Suspense is an important element of a mystery story.
eliminate|verb|to remove or get rid of something|Checking your work can eliminate careless mistakes.
emerge|verb|to come out or appear|A butterfly emerged from its cocoon.
emphasise|verb|to show that something is especially important|The coach emphasised the importance of warming up.|emphasize
enable|verb|to make it possible for someone to do something|Glasses enable him to read the board.
encounter|verb|to meet or come across something unexpectedly|On our walk we encountered a family of ducks.
encourage|verb|to give someone support and confidence|My friends encouraged me to enter the art contest.
endure|verb|to keep going through something difficult|The walkers endured hours of rain.
enhance|verb|to make something better|Good lighting enhances a photograph.
ensure|verb|to make certain that something happens|Please ensure your name is on your homework.
enthusiasm|noun|a strong feeling of excitement and interest|She talked about her new hobby with great enthusiasm.
environment|noun|the natural world, or the surroundings you live or work in|A quiet environment helps me study.
equivalent|adjective|equal in value, amount or meaning|One kilometre is equivalent to a thousand metres.
essential|adjective|completely necessary|Water is essential for all living things.
establish|verb|to start or set up something that will last|The club was established by a group of parents.
estimate|verb|to make a careful guess about an amount|We estimated that the jar held three hundred sweets.
evaluate|verb|to judge how good or useful something is|Evaluate each idea before choosing one.
eventually|adverb|in the end, after a long time|After many tries, he eventually solved the puzzle.
evidence|noun|facts or signs that show something is true|The muddy paw prints were evidence that the dog had been inside.
evident|adjective|easy to see or understand|It was evident that everyone had practised.
evolve|verb|to change slowly over time|Phones have evolved a lot in twenty years.
exaggerate|verb|to make something seem bigger or more important than it is|He exaggerated when he said the fish was as big as a car.
examine|verb|to look at something carefully|The doctor examined my sore wrist.
exceed|verb|to be more than a certain amount|The bag must not exceed the weight limit.
exceptional|adjective|much better than usual|Her drawing skills are exceptional for her age.
exclude|verb|to leave someone or something out|The price excludes delivery.
exhibit|noun|an object or collection shown in a museum or gallery|The dinosaur exhibit is the most popular part of the museum.
expand|verb|to become bigger|The balloon expanded as she blew into it.
expert|noun|a person who knows a lot about a subject|A bird expert helped us name the birds in the park.
explain|verb|to make something clear by giving details or reasons|Can you explain how the game is scored?
explore|verb|to travel around or look at something to learn about it|We explored the old castle on our holiday.
expose|verb|to uncover something so it can be seen|The low tide exposed rocks covered in shells.
express|verb|to show a thought or feeling in words, art or actions|Music is a way to express your feelings.
extend|verb|to make something longer or bigger|The library extended its opening hours during exams.
extraordinary|adjective|very unusual or remarkable|The view from the mountain top was extraordinary.
facilitate|verb|to make something easier to do|The new ramp facilitates access for wheelchair users.
factor|noun|one of the things that affects a result|Weather is a big factor in whether the match goes ahead.
feature|noun|an important or interesting part of something|The best feature of the new phone is its camera.
fierce|adjective|very strong, or angry and frightening|The fierce wind blew the umbrella inside out.
flexible|adjective|able to bend easily, or able to change to suit different situations|Gymnasts need to be very flexible.
focus|verb|to give your attention to one thing|Focus on the ball when you hit it.
former|adjective|from an earlier time|The café is in a former bank.
foundation|noun|the base or starting point that something is built on|Reading every day builds a strong foundation for writing.
fragile|adjective|easily broken or damaged|Wrap the fragile vase in paper before moving it.
frequent|adjective|happening often|There are frequent buses to the city centre.
frustrate|verb|to make someone feel annoyed because they cannot do what they want|The slow internet frustrated everyone.
function|noun|the job or purpose of something|A kettle's function is to boil water.
fundamental|adjective|forming the most important base of something|Kindness is a fundamental part of friendship.
generate|verb|to produce or create something|Wind turbines generate electricity.
generous|adjective|happy to give time, money or help to others|It was generous of her to share her lunch.
genre|noun|a type of story, music or art with its own style|Fantasy is my favourite genre of book.
genuine|adjective|real and honest|His apology was genuine.
global|adjective|involving the whole world|Clean oceans are a global concern.
gradual|adjective|happening slowly, step by step|There was a gradual rise in temperature through the morning.
grateful|adjective|feeling thankful|I am grateful for my friends' help.
guarantee|verb|to promise that something will happen|The shop guarantees that the shoes will last a year.
guidance|noun|help and advice about what to do|With her teacher's guidance, she wrote her first poem.
habit|noun|something you do regularly, often without thinking|Reading before bed is a good habit.
harsh|adjective|unkind, or very difficult to live with|The harsh winter froze the lake.
heritage|noun|traditions, buildings and stories passed down from the past|The castle is part of the town's heritage.
hesitate|verb|to pause before doing or saying something because you are unsure|She hesitated before diving into the cold water.
highlight|noun|the best or most exciting part of something|The highlight of the trip was seeing the dolphins.
hypothesis|noun|an idea that can be tested to see if it is true|Our hypothesis was that plants grow faster with more light.
identify|verb|to recognise or name something|Can you identify this bird from its song?
illustrate|verb|to explain or decorate something with pictures or examples|She illustrated her story with pencil drawings.
imitate|verb|to copy the way someone or something acts or sounds|The parrot can imitate the doorbell.
immense|adjective|extremely large|An immense crowd filled the square.
impact|noun|a strong effect on something|The new park had a big impact on the neighbourhood.
implement|verb|to put a plan into action|The school implemented a new recycling scheme.
imply|verb|to suggest something without saying it directly|His smile implied that he knew the answer.
impression|noun|an idea or feeling you get about someone or something|The tidy room made a good impression on the visitors.
improve|verb|to make or become better|Your writing will improve if you read more.
incident|noun|something that happens, often something unusual|There was a funny incident with a seagull at lunch.
include|verb|to have something as one of the parts|The price includes a free drink.
indicate|verb|to show or point to something|The arrow indicates the way out.
individual|noun|one single person|Each individual on the team has a different role.
influence|noun|the power to change how someone thinks or acts|Her older sister was a big influence on her taste in music.
initial|adjective|happening at the beginning|My initial idea changed after I did some research.
initiative|noun|the ability to decide and act on your own; also, a new plan|She showed initiative by organising a book swap.
innovative|adjective|new and original|The class came up with an innovative way to save water.
inspire|verb|to fill someone with the wish to do something|The athlete's story inspired me to start running.
instance|noun|an example of something|For instance, you could ride a bike instead of taking the bus.
integrate|verb|to combine things so they work together|The app integrates maps with bus times.
intense|adjective|very strong or extreme|The final minutes of the game were intense.
intention|noun|something you plan or mean to do|My intention was to finish my homework before dinner.
interact|verb|to talk or do things with other people or things|The museum lets visitors interact with the exhibits.
interpret|verb|to explain or understand the meaning of something|Different readers may interpret a poem in different ways.
investigate|verb|to try to find out the facts about something|Scientists are investigating why the bees left the hive.
isolate|verb|to keep something apart from others|The island's location isolated it from the mainland.
issue|noun|an important topic or problem that people discuss|Litter is a big issue in our park.
journey|noun|a trip from one place to another|The journey to my grandparents' house takes three hours.
justify|verb|to give good reasons for something|Can you justify your answer with evidence from the text?
legacy|noun|something passed on from the past or left behind by someone|The library is the legacy of a local teacher who loved books.
legend|noun|an old, famous story that may not be completely true; also, a very famous person|The legend tells of a giant who built the rocky shore.
likely|adjective|probably going to happen|It is likely to rain this afternoon.
limit|noun|the greatest amount that is allowed or possible|There is a limit of three books per visit.
literally|adverb|exactly as the words say|The lake was literally frozen solid.
locate|verb|to find exactly where something is|Can you locate Spain on the map?
logical|adjective|making sense because it follows clear reasons|Her answer was logical and easy to follow.
maintain|verb|to keep something in good condition or at the same level|Volunteers maintain the paths in the woods.
major|adjective|very large or important|The bridge is a major route into the city.
manufacture|verb|to make things in large numbers, usually with machines|The factory manufactures bicycles.
massive|adjective|very large and heavy|A massive tree fell across the road.
mature|adjective|behaving in a sensible, grown-up way|He was very mature about losing the game.
maximum|noun|the largest amount possible or allowed|The lift holds a maximum of eight people.
mechanism|noun|the parts of a machine that work together; the way something works|The clock's mechanism is full of tiny gears.
method|noun|a way of doing something|My method for learning spellings is to write them out three times.
migrate|verb|to move from one place to another, often with the seasons|Swallows migrate south for the winter.
minimum|noun|the smallest amount possible or allowed|You need a minimum of four players for this game.
minor|adjective|small and not very important|There were a few minor mistakes in my essay.
modify|verb|to change something slightly|We modified the recipe to make it less sweet.
monitor|verb|to watch or check something over time|The nurse monitored his temperature through the night.
motivate|verb|to make someone want to do something|The prize motivated us to work harder.
mysterious|adjective|strange and hard to explain|A mysterious noise came from the attic.
narrate|verb|to tell a story|The film is narrated by the main character.
negotiate|verb|to talk with others to reach an agreement|We negotiated who would sit in the front seat.
neutral|adjective|not supporting either side|The referee must stay neutral.
notable|adjective|important or interesting enough to be noticed|The town is notable for its colourful houses.
notice|verb|to see or become aware of something|Did you notice the new painting in the hall?
numerous|adjective|very many|The author has written numerous books for children.
objective|noun|something you are trying to achieve; a goal|The objective of the game is to collect all the cards.
obscure|adjective|not well known, or hard to understand|He loves obscure bands that few people have heard of.
observe|verb|to watch something carefully|We observed the birds from behind the hedge.
obstacle|noun|something that blocks your way or makes things difficult|The course had obstacles like walls and tyres.
obtain|verb|to get something, often with effort|You need to obtain a ticket before the show.
obvious|adjective|easy to see or understand|The answer was obvious once I read the clue again.
occasion|noun|a special event, or a time when something happens|A birthday is a happy occasion.
occur|verb|to happen|Eclipses do not occur very often.
option|noun|a choice|You have two options: pasta or soup.
organise|verb|to plan and arrange something|We organised a bake sale for the library.|organize
origin|noun|the place or point where something begins|The river's origin is a spring high in the hills.
original|adjective|new and not copied; also, the first version|Her story had a very original ending.
outcome|noun|the result of something|Nobody could predict the outcome of the match.
overcome|verb|to succeed in dealing with a difficulty|The climbing wall helped her overcome her fear of heights.
participate|verb|to take part in an activity|Everyone can participate in the fun run.
passion|noun|a very strong interest in or love for something|He has a passion for old trains.
patient|adjective|able to wait calmly without getting annoyed|Be patient; the bread needs time to rise.
perceive|verb|to notice or understand something in a certain way|People perceive colours differently in dim light.
perform|verb|to entertain an audience by acting, singing or playing; also, to carry out a task|The choir performed three songs at the concert.
persevere|verb|to keep trying even when something is difficult|If you persevere, the maths will start to make sense.
persist|verb|to keep going or keep happening|The rain persisted all afternoon.
perspective|noun|a particular way of seeing or thinking about something|The story is told from the dog's perspective.
persuade|verb|to make someone agree by giving good reasons|She persuaded her friends to try the new café.
phenomenon|noun|something that happens and can be seen or studied, often something unusual|A rainbow is a natural phenomenon.
portray|verb|to show or describe someone or something in a certain way|The film portrays the inventor as a kind person.
potential|noun|the ability to develop or succeed in the future|The coach saw potential in the young goalkeeper.
precise|adjective|exact and accurate|Give precise measurements for the recipe.
predict|verb|to say what you think will happen|Can you predict how the story ends?
preserve|verb|to keep something safe or in its original state|The museum preserves old letters in special boxes.
previous|adjective|happening before|In the previous chapter, the heroes lost their map.
primary|adjective|main or most important|The primary reason for the trip is to see the whales.
principle|noun|a basic rule or belief|Fair play is a principle of every sport.
priority|noun|something that is more important than other things|Safety is our top priority on the trip.
procedure|noun|a set of steps for doing something|Follow the fire drill procedure calmly.
proceed|verb|to continue or go forward|After the break, we proceeded to the next room.
process|noun|a series of steps that lead to a result|Making paper by hand is a long process.
profound|adjective|very deep or strong|The book had a profound effect on how I see the world.
prohibit|verb|to officially forbid something|The park prohibits bikes on the grass.
prominent|adjective|important and well known, or easy to see|The clock tower is a prominent part of the skyline.
promote|verb|to help something grow or become popular|The poster promotes the school's book fair.
propose|verb|to suggest a plan or idea|I propose that we meet at the library.
proportion|noun|a part of a whole, or how big one thing is compared with another|A large proportion of the class walks to school.
prosper|verb|to be successful and do well|The small bakery prospered after the new houses were built.
protect|verb|to keep someone or something safe|Sunscreen protects your skin.
prove|verb|to show that something is true|The photo proves that we reached the summit.
provide|verb|to give something that is needed|The school provides free fruit at break.
publish|verb|to print or put out writing for the public to read|The magazine published her poem.
pursue|verb|to follow or try to achieve something|He wants to pursue a career in music.
quality|noun|how good or bad something is|The quality of the photos was excellent.
quote|noun|words repeated exactly from what someone said or wrote|The article included a quote from the coach.
range|noun|a set of different things of the same general type|The shop sells a wide range of books.
rare|adjective|not common; not happening often|It is rare to see snow here in April.
react|verb|to do or say something because of something that has happened|How did your friends react to the news?
realistic|adjective|showing things as they really are, or sensible about what can be done|The painting of the fruit looked very realistic.
recall|verb|to remember something|Can you recall the name of the main character?
recognise|verb|to know someone or something because you have seen or heard them before|I recognised my old teacher at the station.|recognize
recommend|verb|to suggest that something is good or useful|I recommend this book to anyone who likes adventure.
record|noun|the best result ever achieved; also, a written account|She broke the school record for the long jump.
recover|verb|to get better after an illness or setback|He recovered quickly from his cold.
reduce|verb|to make something smaller or less|Walking instead of driving reduces pollution.
reflect|verb|to think carefully about something; also, to show an image, like a mirror|Take a moment to reflect on what you learned today.
region|noun|a large area of a country or of the world|This region is known for its apple farms.
reject|verb|to refuse to accept something|The editor rejected the first draft but liked the second.
relevant|adjective|closely connected to the subject|Only include facts that are relevant to your topic.
reliable|adjective|able to be trusted|My old bike is slow but reliable.
reluctant|adjective|not wanting to do something|He was reluctant to leave the party early.
rely|verb|to depend on someone or something|Many people rely on the bus to get to work.
remarkable|adjective|unusual in a way that is worth noticing|The young pianist gave a remarkable performance.
renowned|adjective|famous and admired|The city is renowned for its museums.
replace|verb|to put something new where something old was|We replaced the broken window.
represent|verb|to stand for something, or to act on behalf of others|The dove represents peace.
reputation|noun|what people generally think about someone or something|The café has a reputation for great hot chocolate.
require|verb|to need something|This recipe requires three eggs.
research|noun|careful study to find out new facts|Her research showed that bees prefer blue flowers.
resemble|verb|to look like or be similar to something|The cloud resembled a rabbit.
reside|verb|to live in a place|The author resides in a small village by the sea.
resilient|adjective|able to recover quickly after something difficult|Resilient players bounce back after a bad game.
resolve|verb|to find an answer to a problem|The friends resolved their argument by talking.
resource|noun|something useful, such as money, materials or information|The library is a great resource for homework.
respond|verb|to answer or react|She responded to the message straight away.
restore|verb|to bring something back to its earlier good condition|Volunteers restored the old steam train.
reveal|verb|to show or tell something that was hidden or secret|The final chapter reveals who took the key.
revise|verb|to change and improve a piece of work; also, to study again for a test|She revised her story to make the ending clearer.
reward|noun|something good you get for doing something well|The reward for finishing the hike was an amazing view.
rival|noun|a person or team you compete against|The two schools are old rivals on the football pitch.
routine|noun|the usual order in which you do things|My morning routine starts with breakfast.
scarce|adjective|hard to find because there is not much of it|Water is scarce in the desert.
scheme|noun|an organised plan|The town started a scheme to plant more trees.
scope|noun|the range of things that something covers|The project's scope grew to include the whole school.
secure|adjective|safe and protected|Keep your bike secure with a strong lock.
select|verb|to choose something carefully|Select one book to read over the holiday.
sequence|noun|the order in which things happen|Put the pictures in the right sequence.
series|noun|a number of similar things that come one after another|The author wrote a series of books about the same detective.
significant|adjective|large or important enough to be noticed|There has been a significant rise in the number of cyclists.
similar|adjective|almost the same|My sister and I have similar handwriting.
simulate|verb|to copy how something looks or behaves, often so people can practise|The game simulates flying a plane.
sketch|noun|a quick, simple drawing|She made a sketch of the harbour before painting it.
solution|noun|an answer to a problem|We found a simple solution to the leaking tap.
sophisticated|adjective|advanced and complicated, or showing a lot of knowledge|The robot uses sophisticated sensors to find its way.
source|noun|where something comes from, or where information is found|Always check the source of a fact you read online.
specific|adjective|exact and particular|Give a specific example from the story.
spectacular|adjective|very impressive to look at|The fireworks were spectacular.
spectator|noun|a person who watches an event, especially a sport|Thousands of spectators cheered the runners.
stable|adjective|firm and not likely to move or change|Make sure the ladder is stable before you climb.
status|noun|the position or condition of someone or something|Check the status of your order online.
strategy|noun|a plan for achieving a goal|Our strategy was to pass the ball quickly.
structure|noun|the way the parts of something are arranged; also, a building|A story's structure has a beginning, middle and end.
struggle|verb|to try very hard to do something difficult|I struggled to open the jar.
submit|verb|to hand in work so that it can be judged|Submit your poem before Friday.
subtle|adjective|small and not obvious|There is a subtle difference between the two shades of blue.
succeed|verb|to do what you were trying to do|If at first you don't succeed, try again.
sufficient|adjective|as much as is needed|We had sufficient food for the whole trip.
suggest|verb|to offer an idea for someone to think about|I suggest we start with the easiest question.
summarise|verb|to give the main points in a few words|Summarise the chapter in three sentences.|summarize
superior|adjective|better than something else|The new model has a superior camera.
support|verb|to help someone, or to agree with an idea|My friends support me when I feel nervous.
surround|verb|to be all around something|Tall trees surround the lake.
survey|noun|a set of questions asked to many people to find out what they think|Our survey showed that most students like pizza.
survive|verb|to stay alive or keep going through a difficult time|The plant survived the frost.
sustain|verb|to keep something going over time|Healthy food helps sustain your energy.
symbol|noun|a sign or object that stands for something else|The heart is a symbol of love.
sympathy|noun|the feeling of being sorry for someone's troubles|I felt sympathy for the player who missed the goal.
talent|noun|a natural ability to do something well|She has a talent for drawing animals.
technique|noun|a particular way of doing something that needs skill|The coach showed us a new technique for throwing.
temporary|adjective|lasting only for a short time|The café is in a temporary building while the new one is built.
tension|noun|a feeling of worry or excitement before something happens|You could feel the tension before the penalty kick.
theme|noun|the main idea or message of a story, song or artwork|Friendship is the main theme of the book.
theory|noun|an idea that tries to explain something|Scientists have a theory about why the dinosaurs disappeared.
thrive|verb|to grow or develop well|Tomato plants thrive in warm, sunny weather.
tradition|noun|a custom or belief passed down over many years|It's a family tradition to go for a walk after lunch.
transform|verb|to change something completely|The volunteers transformed the empty lot into a garden.
transition|noun|a change from one state or stage to another|The transition from primary to secondary school can feel big.
transport|verb|to carry people or goods from one place to another|Lorries transport fruit to the supermarkets.
trend|noun|a general change or direction in how things are developing|There is a trend towards cycling to work.
triumph|noun|a great success or win|Winning the cup was a triumph for the small club.
typical|adjective|usual and normal for a particular person or thing|On a typical day, I walk to school.
ultimate|adjective|final, or the greatest possible|The ultimate goal is to win the championship.
undergo|verb|to experience something, often a change|The old bridge will undergo repairs this summer.
unique|adjective|being the only one of its kind|Every snowflake is unique.
urge|verb|to strongly encourage someone to do something|The coach urged us to drink plenty of water.
urgent|adjective|needing attention right away|The message was urgent, so she called back straight away.
utilise|verb|to use something for a purpose|The garden utilises rainwater from the roof.|utilize
valid|adjective|reasonable and acceptable, or officially allowed|That is a valid point.
valuable|adjective|worth a lot of money, or very useful|Practice gave her valuable experience.
vary|verb|to be different, or to change|Prices vary from shop to shop.
vast|adjective|extremely large|The Pacific Ocean is vast.
venture|noun|a new activity or project that involves some risk|Opening the bike shop was an exciting venture.
version|noun|a form of something that is slightly different from others|The film is a new version of an old fairy tale.
victory|noun|a win in a game or contest|The team celebrated its first victory of the season.
vivid|adjective|very bright, or very clear and detailed|She has vivid memories of her first day at school.
volunteer|noun|a person who does work without being paid|Volunteers help run the town's food bank.
vulnerable|adjective|easily hurt or harmed|Baby birds are vulnerable when they leave the nest.
widespread|adjective|happening in many places or among many people|There was widespread excitement about the new park.
witness|verb|to see something happen|We witnessed a rainbow over the sea.
worthwhile|adjective|worth the time or effort|Visiting the museum was worthwhile.
`;

const PARTS_OF_SPEECH: readonly PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb', 'preposition'];

function isPartOfSpeech(value: string): value is PartOfSpeech {
  return (PARTS_OF_SPEECH as readonly string[]).includes(value);
}

function parseTable(table: string): WordListEntry[] {
  return table
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [word, partOfSpeech, definition, example, variants = ''] = line.split('|');
      if (!word || !partOfSpeech || !definition || !example || !isPartOfSpeech(partOfSpeech)) {
        throw new Error(`Malformed word list line: ${line}`);
      }
      return {
        word,
        partOfSpeech,
        definition,
        example,
        variants: variants.split(',').map((v) => v.trim()).filter(Boolean),
      };
    });
}

export const TIER2_WORDS: readonly WordListEntry[] = parseTable(TIER2_TABLE);

const TIER2_INDEX = new Map<string, WordListEntry>();
for (const entry of TIER2_WORDS) {
  TIER2_INDEX.set(entry.word, entry);
  for (const variant of entry.variants) TIER2_INDEX.set(variant, entry);
}

/** The tier-2 entry for an exact (lower-case) headword or spelling variant. */
export function tier2Entry(word: string): WordListEntry | undefined {
  return TIER2_INDEX.get(word.toLowerCase());
}

const COMMON_LONG_WORD_LIST = `
ability absolutely academic accident account actually addition address adventure afternoon against airport
already although amazing another anybody anymore anything anyway anywhere apartment appointment
article artist artists attention automatic autumn average awesome backpack backwards balance baseball
basketball bathroom beautiful because bedroom beginning believe believed between bicycle birthday blanket
breakfast brother brothers brought building buildings business calendar capital captain careful
carried carrying cartoon ceiling century certain certainly chapter chicken children chocolate
classroom classmate classmates climbing clothes collect collection college comment company complete
completely computer concert confused contest continue continued control correct costume cottage country
countries courage cricket crowded curtain customer customers dangerous daughter decided decision definitely
delicious dentist describe designer designers diamond different difficult dinosaur director disaster
discover distance doctors dolphin downstairs drawing drawings earlier education electric
electricity elephant elevator emotion emotions english enjoyed enormous entrance episode especially
evening everybody everyone everything everywhere example examples excellent excited exciting exercise
experience experiment explain explained factory familiar families family famous fantastic farmers
favourite favorite february festival finally finished footballer football forward friendly friends
friendship funniest furniture gallery general generation gentle giraffe goalkeeper government
grandfather grandmother grandparents greatest guitar haircut happened happening headline headlines
healthy heavily history holiday holidays homework hospital however hundred hundreds husband imagine
important impossible including information instead instrument instruments interest interested
interesting internet interview january journalist kitchen language languages laughing laughter
library listening machine machines magazine magazines manager married material meaning measure medicine
meeting message midnight million millions minutes mistake mistakes monster morning mountain mountains
musical musician musicians mystery natural nearly neighbour neighbours neighbor network newspaper
nothing november nowhere numbers obviously october officer official online opening opinion ordinary
organisation organization outside painting paintings parents partner passenger payment penalty
perfect perhaps person personal photograph photographs picture pictures planet plastic players
playground pleasant pocket police popular position possible poster practice practise president
pressure pretend pretty princess printer private probably problem problems product program programme
project projects promise protect question questions quickly quietly rainbow reading reality
recently remember reporter reporters rescue restaurant results science scientist scientists
scissors season seasons secret section seconds september several shopping shoulder silence
similar singer singers sister sisters skateboard someone something sometimes somewhere special
stadium started station stories stomach straight strange stranger strength student students studio
subject subjects success suddenly summer support supporters surprise surprised swimming teacher
teachers teenager teenagers telephone television terrible thinking thousand thousands through
together tomorrow tonight tournament towards traffic trainer trainers training travelled traveled
travelling treasure trouble uniform universe university unusual upstairs usually vacation vegetable
vegetables village visitor visitors volleyball weather website wedding weekend welcome whatever
whenever whether without wonderful workers working workshop writer writers writing written yesterday
`;

export const COMMON_LONG_WORDS: ReadonlySet<string> = new Set(COMMON_LONG_WORD_LIST.split(/\s+/).filter(Boolean));
