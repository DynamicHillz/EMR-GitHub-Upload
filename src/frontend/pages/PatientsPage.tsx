import React, { useState, useEffect, useCallback, KeyboardEvent } from 'react';
import { Plus, Search, User, Calendar, Phone, AlertCircle, X } from 'lucide-react';
import PatientDetailView from '../components/PatientDetailView';
import { useToast } from '../components/ToastContainer';
import ErrorAlert from '../components/common/ErrorAlert';

// ── Nigeria State → LGA map ──────────────────────────────────────────────────
const NIGERIA_LGA_MAP: Record<string, string[]> = {
  'Abia': ['Aba North','Aba South','Arochukwu','Bende','Ikwuano','Isiala Ngwa North','Isiala Ngwa South','Isuikwuato','Obi Ngwa','Ohafia','Osisioma Ngwa','Ugwunagbo','Ukwa East','Ukwa West','Umu Nneochi','Umuahia North','Umuahia South'],
  'Adamawa': ['Demsa','Fufore','Ganye','Gayuk','Gombi','Grie','Hong','Jada','Lamurde','Madagali','Maiha','Mayo-Belwa','Michika','Mubi North','Mubi South','Numan','Shelleng','Song','Toungo','Yola North','Yola South'],
  'Akwa Ibom': ['Abak','Eastern Obolo','Eket','Esit Eket','Essien Udim','Etim Ekpo','Etinan','Ibeno','Ibesikpo Asutan','Ibiono-Ibom','Ika','Ikono','Ikot Abasi','Ikot Ekpene','Ini','Itu','Mbo','Mkpat-Enin','Nsit-Atai','Nsit-Ibom','Nsit-Ubium','Obot Akara','Okobo','Onna','Oron','Oruk Anam','Udung-Uko','Ukanafun','Uruan','Urue-Offong/Oruko','Uyo'],
  'Anambra': ['Aguata','Anambra East','Anambra West','Anaocha','Awka North','Awka South','Ayamelum','Dunukofia','Ekwusigo','Idemili North','Idemili South','Ihiala','Njikoka','Nnewi North','Nnewi South','Ogbaru','Onitsha North','Onitsha South','Orumba North','Orumba South','Oyi'],
  'Bauchi': ['Alkaleri','Bauchi','Bogoro','Damban','Darazo','Dass','Gamawa','Ganjuwa','Giade','Itas/Gadau',"Jama'are",'Katagum','Kirfi','Misau','Ningi','Shira','Tafawa Balewa','Toro','Warji','Zaki'],
  'Bayelsa': ['Brass','Ekeremor','Kolokuma/Opokuma','Nembe','Ogbia','Sagbama','Southern Ijaw','Yenagoa'],
  'Benue': ['Ado','Agatu','Apa','Buruku','Gboko','Guma','Gwer East','Gwer West','Katsina-Ala','Konshisha','Kwande','Logo','Makurdi','Obi','Ogbadibo','Ohimini','Oju','Okpokwu','Otukpo','Tarka','Ukum','Ushongo','Vandeikya'],
  'Borno': ['Abadam','Askira/Uba','Bama','Bayo','Biu','Chibok','Damboa','Dikwa','Gubio','Guzamala','Gwoza','Hawul','Jere','Kaga','Kala/Balge','Konduga','Kukawa','Kwaya Kusar','Mafa','Magumeri','Maiduguri','Marte','Mobbar','Monguno','Ngala','Nganzai','Shani'],
  'Cross River': ['Abi','Akamkpa','Akpabuyo','Bakassi','Bekwarra','Biase','Boki','Calabar Municipal','Calabar South','Etung','Ikom','Obanliku','Obubra','Obudu','Odukpani','Ogoja','Yakurr','Yala'],
  'Delta': ['Aniocha North','Aniocha South','Bomadi','Burutu','Ethiope East','Ethiope West','Ika North East','Ika South','Isoko North','Isoko South','Ndokwa East','Ndokwa West','Okpe','Oshimili North','Oshimili South','Patani','Sapele','Udu','Ughelli North','Ughelli South','Ukwuani','Uvwie','Warri North','Warri South','Warri South West'],
  'Ebonyi': ['Abakaliki','Afikpo North','Afikpo South','Ebonyi','Ezza North','Ezza South','Ikwo','Ishielu','Ivo','Izzi','Ohaozara','Ohaukwu','Onicha'],
  'Edo': ['Akoko-Edo','Egor','Esan Central','Esan North-East','Esan South-East','Esan West','Etsako Central','Etsako East','Etsako West','Igueben','Ikpoba-Okha','Oredo','Orhionmwon','Ovia North-East','Ovia South-West','Owan East','Owan West','Uhunmwonde'],
  'Ekiti': ['Ado-Ekiti','Efon','Ekiti East','Ekiti South-West','Ekiti West','Emure','Gbonyin','Ido-Osi','Ijero','Ikere','Ikole','Ilejemeje','Irepodun/Ifelodun','Ise/Orun','Moba','Oye'],
  'Enugu': ['Aninri','Awgu','Enugu East','Enugu North','Enugu South','Ezeagu','Igbo-Etiti','Igbo-Eze North','Igbo-Eze South','Isi-Uzo','Nkanu East','Nkanu West','Nsukka','Oji River','Udenu','Udi','Uzo-Uwani'],
  'FCT - Abuja': ['Abaji','Bwari','Gwagwalada','Kuje','Kwali','Municipal'],
  'Gombe': ['Akko','Balanga','Billiri','Dukku','Funakaye','Gombe','Kaltungo','Kwami','Nafada','Shongom','Yamaltu/Deba'],
  'Imo': ['Aboh Mbaise','Ahiazu Mbaise','Ehime Mbano','Ezinihitte Mbaise','Ideato North','Ideato South','Ihitte/Uboma','Ikeduru','Isiala Mbano','Isu','Mbaitoli','Ngor-Okpala','Njaba','Nkwerre','Nwangele','Obowo','Oguta','Ohaji/Egbema','Okigwe','Onuimo','Orlu','Orsu','Oru East','Oru West','Owerri Municipal','Owerri North','Owerri West'],
  'Jigawa': ['Auyo','Babura','Biriniwa','Birnin Kudu','Buji','Dutse','Gagarawa','Garki','Gumel','Guri','Gwaram','Gwiwa','Hadejia','Jahun','Kafin Hausa','Kaugama','Kazaure','Kiri Kasama','Kiyawa','Maigatari','Malam Madori','Miga','Ringim','Roni','Sule Tankarkar','Taura','Yankwashi'],
  'Kaduna': ['Birnin Gwari','Chikun','Giwa','Igabi','Ikara','Jaba',"Jema'a",'Kachia','Kaduna North','Kaduna South','Kagarko','Kajuru','Kaura','Kauru','Kubau','Kudan','Lere','Makarfi','Sabon Gari','Sanga','Soba','Zangon Kataf','Zaria'],
  'Kano': ['Ajingi','Albasu','Bagwai','Bebeji','Bichi','Bunkure','Dala','Dambatta','Dawakin Kudu','Dawakin Tofa','Doguwa','Fagge','Gabasawa','Garko','Garun Mallam','Gaya','Gezawa','Gwale','Gwarzo','Kabo','Kano Municipal','Karaye','Kibiya','Kiru','Kumbotso','Kunchi','Kura','Madobi','Makoda','Minjibir','Nassarawa','Rano','Rimin Gado','Rogo','Shanono','Sumaila','Takai','Tarauni','Tofa','Tsanyawa','Tudun Wada','Ungogo','Warawa','Wudil'],
  'Katsina': ['Bakori','Batagarawa','Batsari','Baure','Bindawa','Charanchi','Dan Musa','Dandume','Danja','Daura','Dutsi','Dutsin-Ma','Faskari','Funtua','Ingawa','Jibia','Kafur','Kaita','Kankara','Kankia','Katsina','Kurfi','Kusada',"Mai'Adua",'Malumfashi','Mani','Mashi','Matazu','Musawa','Rimi','Sabuwa','Safana','Sandamu','Zango'],
  'Kebbi': ['Aleiro','Arewa Dandi','Argungu','Augie','Bagudo','Birnin Kebbi','Bunza','Dandi','Fakai','Gwandu','Jega','Kalgo','Koko/Besse','Maiyama','Ngaski','Sakaba','Shanga','Suru','Wasagu/Danko','Yauri','Zuru'],
  'Kogi': ['Adavi','Ajaokuta','Ankpa','Bassa','Dekina','Ibaji','Idah','Igalamela-Odolu','Ijumu','Kabba/Bunu','Kogi','Lokoja','Mopa-Muro','Ofu','Ogori/Magongo','Okehi','Okene','Olamaboro','Omala','Yagba East','Yagba West'],
  'Kwara': ['Asa','Baruten','Edu','Ekiti','Ifelodun','Ilorin East','Ilorin South','Ilorin West','Irepodun','Isin','Kaiama','Moro','Offa','Oke Ero','Oyun','Patigi'],
  'Lagos': ['Agege','Ajeromi-Ifelodun','Alimosho','Amuwo-Odofin','Apapa','Badagry','Epe','Eti-Osa','Ibeju-Lekki','Ifako-Ijaiye','Ikeja','Ikorodu','Kosofe','Lagos Island','Lagos Mainland','Mushin','Ojo','Oshodi-Isolo','Shomolu','Surulere'],
  'Nasarawa': ['Akwanga','Awe','Doma','Karu','Keana','Keffi','Kokona','Lafia','Nasarawa','Nasarawa Egon','Obi','Toto','Wamba'],
  'Niger': ['Agaie','Agwara','Bida','Borgu','Bosso','Chanchaga','Edati','Gbako','Gurara','Katcha','Kontagora','Lapai','Lavun','Magama','Mariga','Mashegu','Mokwa','Munya','Paikoro','Rafi','Rijau','Shiroro','Suleja','Tafa','Wushishi'],
  'Ogun': ['Abeokuta North','Abeokuta South','Ado-Odo/Ota','Egbado North','Egbado South','Ewekoro','Ifo','Ijebu East','Ijebu North','Ijebu North East','Ijebu Ode','Ikenne','Imeko Afon','Ipokia','Obafemi Owode','Odeda','Odogbolu','Ogun Waterside','Remo North','Sagamu'],
  'Ondo': ['Akoko North-East','Akoko North-West','Akoko South-East','Akoko South-West','Akure North','Akure South','Ese-Odo','Idanre','Ifedore','Ilaje','Ile Oluji/Okeigbo','Irele','Odigbo','Okitipupa','Ondo East','Ondo West','Ose','Owo'],
  'Osun': ['Aiyedaade','Aiyedire','Atakunmosa East','Atakunmosa West','Boluwaduro','Boripe','Ede North','Ede South','Egbedore','Ejigbo','Ife Central','Ife East','Ife North','Ife South','Ifedayo','Ifelodun','Ila','Ilesa East','Ilesa West','Irepodun','Irewole','Isokan','Iwo','Obokun','Odo Otin','Ola Oluwa','Olorunda','Oriade','Orolu','Osogbo'],
  'Oyo': ['Afijio','Akinyele','Atiba','Atisbo','Egbeda','Ibadan North','Ibadan North-East','Ibadan North-West','Ibadan South-East','Ibadan South-West','Ibarapa Central','Ibarapa East','Ibarapa North','Ido','Irepo','Iseyin','Itesiwaju','Iwajowa','Kajola','Lagelu','Ogbomoso North','Ogbomoso South','Ogo Oluwa','Olorunsogo','Oluyole','Ona Ara','Orelope','Ori Ire','Oyo East','Oyo West','Saki East','Saki West','Surulere'],
  'Plateau': ['Barkin Ladi','Bassa','Bokkos','Jos East','Jos North','Jos South','Kanam','Kanke','Langtang North','Langtang South','Mangu','Mikang','Pankshin',"Qua'an Pan",'Riyom','Shendam','Wase'],
  'Rivers': ['Abua/Odual','Ahoada East','Ahoada West','Akuku-Toru','Andoni','Asari-Toru','Bonny','Degema','Eleme','Emohua','Etche','Gokana','Ikwerre','Khana','Obio/Akpor','Ogba/Egbema/Ndoni','Ogu/Bolo','Okrika','Omuma','Opobo/Nkoro','Oyigbo','Port Harcourt','Tai'],
  'Sokoto': ['Binji','Bodinga','Dange Shuni','Gada','Goronyo','Gudu','Gwadabawa','Illela','Isa','Kebbe','Kware','Rabah','Sabon Birni','Shagari','Silame','Sokoto North','Sokoto South','Tambuwal','Tangaza','Tureta','Wamako','Wurno','Yabo'],
  'Taraba': ['Ardo Kola','Bali','Donga','Gashaka','Gassol','Ibi','Jalingo','Karim Lamido','Kumi','Lau','Sardauna','Takum','Ussa','Wukari','Yorro','Zing'],
  'Yobe': ['Bade','Bursari','Damaturu','Fika','Fune','Geidam','Gujba','Gulani','Jakusko','Karasuwa','Machina','Nangere','Nguru','Potiskum','Tarmuwa','Yunusari','Yusufari'],
  'Zamfara': ['Anka','Bakura','Birnin Magaji/Kiyaw','Bukkuyum','Bungudu','Gummi','Gusau','Kaura Namoda','Maradun','Maru','Shinkafi','Talata Mafara','Tsafe','Zurmi'],
};

const NIGERIAN_STATES = Object.keys(NIGERIA_LGA_MAP).sort();

// ── Tag input component ──────────────────────────────────────────────────────
const TagInput: React.FC<{
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
  chipColor: 'red' | 'yellow';
}> = ({ tags, onChange, placeholder, chipColor }) => {
  const [inputValue, setInputValue] = useState('');

  const addTag = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setInputValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const chipClass =
    chipColor === 'red'
      ? 'bg-red-100 text-red-800 border border-red-200'
      : 'bg-yellow-100 text-yellow-800 border border-yellow-200';

  return (
    <div
      className="input w-full min-h-[44px] h-auto flex flex-wrap gap-2 p-2 cursor-text"
      onClick={() => document.getElementById(`tag-${placeholder}`)?.focus()}
    >
      {tags.map((tag, i) => (
        <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-medium ${chipClass}`}>
          {tag}
          <button type="button" onClick={e => { e.stopPropagation(); onChange(tags.filter((_, j) => j !== i)); }} className="hover:opacity-70">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        id={`tag-${placeholder}`}
        type="text"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputValue.trim()) addTag(inputValue); }}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"
      />
    </div>
  );
};

// ── Types ────────────────────────────────────────────────────────────────────
interface PatientFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  dobUnknown: boolean;
  approximateYear: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  phone: string;
  email: string;
  address: string;
  state: string;
  lga: string;
  bloodGroup: string;
  genotype: string;
  allergies: string[];
  chronicConditions: string[];
  pastSurgicalHistory: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  consentGiven: boolean;
}

interface Patient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  age: number;
  gender: string;
  phone: string;
  hasAllergies: boolean;
  createdAt: string;
}

const EMPTY_FORM: PatientFormData = {
  firstName: '', lastName: '', dateOfBirth: '', dobUnknown: false,
  approximateYear: '', gender: 'MALE', phone: '', email: '',
  address: '', state: '', lga: '', bloodGroup: '', genotype: '',
  allergies: [], chronicConditions: [], pastSurgicalHistory: '',
  emergencyContactName: '', emergencyContactPhone: '',
  emergencyContactRelationship: '', consentGiven: false,
};

// ── Page ─────────────────────────────────────────────────────────────────────
const PatientsPage: React.FC = () => {
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<PatientFormData>(EMPTY_FORM);

  // Derived: LGAs for selected state
  const availableLGAs = formData.state ? (NIGERIA_LGA_MAP[formData.state] ?? []) : [];

  const searchPatients = useCallback(async (query: string) => {
    if (query.length < 3 && query.length > 0) return;
    if (query.length === 0) { setSearchResults([]); setShowResults(false); return; }
    setIsSearching(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(
        `http://localhost:3000/api/patients/search?query=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setSearchResults(res.ok ? (data.data || []) : []);
      if (res.ok) setShowResults(true);
    } catch { setSearchResults([]); }
    finally { setIsSearching(false); }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => searchPatients(searchQuery), 300);
    return () => clearTimeout(id);
  }, [searchQuery, searchPatients]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    // When state changes, reset LGA
    if (name === 'state') {
      setFormData(prev => ({ ...prev, state: value, lga: '' }));
      return;
    }
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const resolveDOB = (): string => {
    if (formData.dobUnknown && formData.approximateYear) return `${formData.approximateYear}-01-01`;
    return formData.dateOfBirth;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const dob = resolveDOB();
    if (!dob) { setError('Please provide a date of birth or approximate year.'); setIsSubmitting(false); return; }

    try {
      const token = localStorage.getItem('token');
      if (!token) { setError('Please login first'); setIsSubmitting(false); return; }

      const hasEmergencyContact =
        formData.emergencyContactName.trim() ||
        formData.emergencyContactPhone.trim() ||
        formData.emergencyContactRelationship.trim();

      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: dob,
        gender: formData.gender,
        phone: formData.phone,
        email: formData.email || undefined,
        address: formData.address || undefined,
        state: formData.state,
        lga: formData.lga || undefined,
        bloodGroup: formData.bloodGroup || undefined,
        genotype: formData.genotype || undefined,
        allergies: formData.allergies,
        chronicConditions: formData.chronicConditions,
        pastSurgicalHistory: formData.pastSurgicalHistory || undefined,
        emergencyContact: hasEmergencyContact ? {
          name: formData.emergencyContactName,
          phone: formData.emergencyContactPhone,
          relationship: formData.emergencyContactRelationship,
        } : undefined,
        consentGiven: formData.consentGiven,
      };

      const res = await fetch('http://localhost:3000/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success('Patient Registered Successfully!', `Patient ID: ${data.data.patientId} has been created.`);
        setShowModal(false);
        setFormData(EMPTY_FORM);
      } else {
        toast.error('Registration Failed', data.message || 'Please try again.');
      }
    } catch {
      toast.error('Registration Failed', 'Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Patients</h2>
        <button className="btn btn-primary flex items-center" onClick={() => setShowModal(true)}>
          <Plus className="w-5 h-5 mr-2" /> Register New Patient
        </button>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorAlert message={error} severity="error" onDismiss={() => setError('')} />
        </div>
      )}

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search patients by name, phone, or patient ID (min 3 characters)..."
            className="input pl-10 w-full"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.length >= 3 && setShowResults(true)}
          />
          {isSearching && (
            <div className="absolute right-3 top-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            </div>
          )}
        </div>

        {showResults && searchQuery.length >= 3 && (
          <div className="absolute z-10 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
            {searchResults.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {searchResults.map(patient => (
                  <div key={patient.id} onClick={() => { setSelectedPatient(patient); setShowResults(false); }}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-gray-900">{patient.fullName}</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{patient.patientId}</span>
                      {patient.hasAllergies && <AlertCircle className="w-4 h-4 text-red-500" title="Has allergies" />}
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-600 ml-6">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{patient.age} yrs</span>
                      <span>{patient.gender}</span>
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{patient.phone}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No patients found matching &quot;{searchQuery}&quot;</p>
                <p className="text-sm mt-1">Try name, phone number, or patient ID</p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedPatient ? (
        <PatientDetailView patientId={selectedPatient.id} onBack={() => setSelectedPatient(null)} />
      ) : (
        <div className="card">
          <p className="text-gray-600 text-center py-8">
            {searchQuery ? 'Search for a patient above to view details' : 'Use the search bar above to find patients by name, phone, or patient ID'}
          </p>
        </div>
      )}

      {/* Registration Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10 rounded-t-lg">
              <div>
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <User className="w-6 h-6 text-purple-600" /> Register New Patient
                </h3>
                <p className="text-sm text-gray-600 mt-1">Complete the form below to register a new patient</p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <Plus className="w-6 h-6 transform rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">

              {/* Personal Information */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-lg border-b pb-2">Personal Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div>
                    <label className="block text-sm font-medium mb-1">First Name *</label>
                    <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} className="input w-full" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Last Name *</label>
                    <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} className="input w-full" required />
                  </div>

                  {/* DOB with unknown escape hatch */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Date of Birth *</label>
                    <div className="flex items-center gap-2 mb-2">
                      <input type="checkbox" name="dobUnknown" id="dobUnknown" checked={formData.dobUnknown} onChange={handleInputChange} />
                      <label htmlFor="dobUnknown" className="text-sm text-gray-600">
                        Date of birth unknown — enter approximate year instead
                      </label>
                    </div>
                    {formData.dobUnknown ? (
                      <input type="number" name="approximateYear" value={formData.approximateYear} onChange={handleInputChange}
                        placeholder="e.g. 1965" min="1900" max={new Date().getFullYear()} className="input w-full" required />
                    ) : (
                      <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleInputChange} className="input w-full" required />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Gender *</label>
                    <select name="gender" value={formData.gender} onChange={handleInputChange} className="input w-full" required>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone *</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange}
                      placeholder="08012345678 or +2348012345678" className="input w-full" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="input w-full" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Address</label>
                    <input type="text" name="address" value={formData.address} onChange={handleInputChange} className="input w-full" />
                  </div>

                  {/* State → LGA dynamic dropdown */}
                  <div>
                    <label className="block text-sm font-medium mb-1">State *</label>
                    <select name="state" value={formData.state} onChange={handleInputChange} className="input w-full" required>
                      <option value="">Select state...</option>
                      {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">LGA</label>
                    <select name="lga" value={formData.lga} onChange={handleInputChange} className="input w-full" disabled={!formData.state}>
                      <option value="">{formData.state ? 'Select LGA...' : 'Select state first'}</option>
                      {availableLGAs.map(lga => <option key={lga} value={lga}>{lga}</option>)}
                    </select>
                  </div>

                </div>
              </div>

              {/* Medical History */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-lg border-b pb-2">Medical History</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Blood Group</label>
                    <select name="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange} className="input w-full">
                      <option value="">Select...</option>
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Genotype</label>
                    <select name="genotype" value={formData.genotype} onChange={handleInputChange} className="input w-full">
                      <option value="">Select...</option>
                      {['AA','AS','SS','AC','SC'].map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      Known Allergies{' '}
                      <span className="text-gray-400 font-normal">(type and press Enter or comma to add)</span>
                    </label>
                    <TagInput
                      tags={formData.allergies}
                      onChange={tags => setFormData(prev => ({ ...prev, allergies: tags }))}
                      placeholder="e.g. Penicillin, Peanuts, Sulfa drugs..."
                      chipColor="red"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      Chronic Conditions{' '}
                      <span className="text-gray-400 font-normal">(type and press Enter or comma to add)</span>
                    </label>
                    <TagInput
                      tags={formData.chronicConditions}
                      onChange={tags => setFormData(prev => ({ ...prev, chronicConditions: tags }))}
                      placeholder="e.g. Diabetes, Hypertension, Asthma..."
                      chipColor="yellow"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Past Surgical History / Major Procedures</label>
                    <textarea name="pastSurgicalHistory" value={formData.pastSurgicalHistory} onChange={handleInputChange}
                      placeholder="e.g. Appendectomy (2018), Cesarean Section (2020)" className="input w-full" rows={3} />
                  </div>
                </div>
              </div>

              {/* Emergency Contact — optional */}
              <div className="mb-6">
                <h4 className="font-semibold mb-1 text-lg border-b pb-2">
                  Emergency Contact <span className="text-sm font-normal text-gray-400">(optional)</span>
                </h4>
                <p className="text-xs text-gray-500 mb-3">Can be added later from the patient record if not available now.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input type="text" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleInputChange} className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Relationship</label>
                    <input type="text" name="emergencyContactRelationship" value={formData.emergencyContactRelationship} onChange={handleInputChange} className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <input type="tel" name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleInputChange} placeholder="08012345678" className="input w-full" />
                  </div>
                </div>
              </div>

              {/* Consent — NDPR only */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-lg border-b pb-2">Data Processing Consent</h4>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h5 className="font-semibold text-sm mb-2 text-blue-900">Consent to Data Processing</h5>
                  <p className="text-sm text-blue-800 mb-2">
                    By providing your consent, you agree to allow St. Stephen&apos;s Medical Centre to collect, store,
                    and process your personal and medical information for the following purposes:
                  </p>
                  <ul className="text-sm text-blue-800 list-disc list-inside space-y-1 ml-2">
                    <li>Providing medical care and treatment</li>
                    <li>Maintaining your medical records</li>
                    <li>Billing and insurance purposes</li>
                    <li>Legal and regulatory compliance</li>
                    <li>Quality improvement and patient safety</li>
                  </ul>
                  <p className="text-xs text-blue-700 mt-3">
                    Your data will be protected in accordance with the Nigeria Data Protection Regulation (NDPR).
                    You have the right to access, modify, or request deletion of your data at any time.
                  </p>
                  <p className="text-xs text-blue-600 mt-2 font-medium">
                    Consent Version: 1.0 | Effective Date: {new Date().toLocaleDateString()}
                  </p>
                </div>
                <label className="flex items-start">
                  <input type="checkbox" name="consentGiven" checked={formData.consentGiven} onChange={handleInputChange} className="mr-2 mt-1" required />
                  <span className="text-sm">
                    <strong>I have read and understood the above information.</strong> I consent to the collection,
                    storage, and processing of my personal and medical data by St. Stephen&apos;s Medical Centre as described above. *
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary" disabled={isSubmitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Registering...' : 'Register Patient'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientsPage;