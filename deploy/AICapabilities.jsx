import { Link } from 'react-router-dom';

const services = [
  ['General AI Assistant', 'Ask questions, develop ideas, draft documents, explain difficult topics and work through practical personal or business tasks in one conversational workspace.'],
  ['Business Planning', 'Develop structured business concepts, plans, operating ideas, market approaches and working documents through guided conversation tailored to the user’s goal.'],
  ['Resume Builder', 'Create and refine professional resumes through a dedicated tool, helping users organise experience, education, skills and career information into a usable document.'],
  ['Contract Builder', 'Prepare working contract drafts through a guided builder. Generated drafts remain subject to review and do not replace independent legal advice.'],
  ['Logo & Image Generation', 'Create brand concepts, logos, illustrations and other visual material from written instructions, with dedicated controls for common creative tasks.'],
  ['Video Generation', 'Turn an idea or prompt into generated video content through a dedicated creation workflow available inside the assistant.'],
  ['256 Code', 'A dedicated coding workspace for generating, explaining, debugging and improving software. It gives builders a focused route from a product idea or technical question toward code they can inspect, test and refine.'],
  ['Deep Think', 'A selectable reasoning mode for professional tasks that benefit from more deliberate analysis. The interface displays the user’s current Deep Think allowance and the credit cost before use.'],
  ['Current Web Search', 'The assistant can use web-search allowances for requests that require current online information, rather than treating all questions as timeless or relying only on conversational memory.'],
  ['Languages & Appearance', 'The interface provides English, Luganda, Swahili and Acholi controls alongside dark, light and gold appearance themes.'],
  ['History, Account & Usage Controls', 'Registered users can return to conversation history and manage prompts, credits, web searches, Deep Think allowances, settings and plan information from one account.'],
];

export default function Capabilities() {
  return <main style={{minHeight:'100vh',background:'#080808',color:'#fff',fontFamily:'DM Sans,Arial,sans-serif',padding:'70px 22px'}}>
    <div style={{maxWidth:1050,margin:'auto'}}>
      <nav style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:70}}><Link to="/chat" style={{color:'#f4cf63',fontWeight:900,textDecoration:'none'}}>256 AI</Link><div style={{display:'flex',gap:18}}><Link to="/news" style={{color:'#fff'}}>News</Link><Link to="/login" style={{color:'#fff'}}>Sign in</Link></div></nav>
      <p style={{color:'#f4cf63',fontWeight:800,letterSpacing:2,textTransform:'uppercase'}}>Built in Uganda · Practical artificial intelligence</p>
      <h1 style={{fontSize:'clamp(42px,8vw,82px)',lineHeight:1,margin:'18px 0 26px'}}>Uganda’s intelligent assistant for work, ideas and creation</h1>
      <p style={{fontSize:20,lineHeight:1.7,color:'#ccc',maxWidth:820}}>256 AI is a Uganda-built artificial-intelligence service that brings conversational assistance and specialist creation tools into one account. It gives Ugandan users and organisations a locally operated option in the same broad assistant category as global services such as ChatGPT and Claude, while presenting its own tools, identity and service environment.</p>
      <section style={{marginTop:70}}><h2 style={{fontSize:36}}>What users can do with 256 AI</h2><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:18,marginTop:28}}>{services.map(([name,text])=><article key={name} style={{border:'1px solid #3f3723',borderTop:'3px solid #d2a934',padding:24,background:'#111'}}><h3 style={{fontSize:22,marginTop:0}}>{name}</h3><p style={{color:'#bbb',lineHeight:1.65}}>{text}</p></article>)}</div></section>
      <section style={{marginTop:70,maxWidth:850}}><h2 style={{fontSize:36}}>Why a Uganda-built AI service matters</h2><p style={{color:'#ccc',fontSize:18,lineHeight:1.75}}>People increasingly use AI assistants to turn rough ideas into useful first drafts, understand information, prepare professional material and create digital content. A Uganda-built service can make that category of technology more visible and approachable to local users, entrepreneurs, professionals, students and organisations. Its value depends on the quality of its outputs, responsible use and continued improvement—not on unsupported claims that every generated result is automatically correct.</p><p style={{color:'#ccc',fontSize:18,lineHeight:1.75}}>256 AI is designed as a practical workspace rather than a claim to replace professional judgement. Business plans should be tested against real market evidence. Resumes should be checked by their owners. Contracts require appropriate legal review. Code must be tested, and generated media should be reviewed before publication.</p></section>
      <section style={{marginTop:60,padding:30,background:'linear-gradient(135deg,#7a5608,#e2bb4e,#8a6414)',color:'#111'}}><h2 style={{fontSize:32,marginTop:0}}>Access 256 AI</h2><p style={{fontSize:18}}>Create an account or sign in at ai.256.co.ug. Tool availability and usage allowances may depend on the user’s current account or plan; current details are shown inside the service.</p><Link to="/register" style={{display:'inline-block',background:'#111',color:'#fff',padding:'13px 20px',fontWeight:800,textDecoration:'none'}}>Create a free account →</Link></section>
    </div>
  </main>;
}
